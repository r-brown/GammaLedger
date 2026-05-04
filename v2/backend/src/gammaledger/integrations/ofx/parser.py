"""OFX parser for broker investment transactions.

The legacy browser parser accepts SGML-ish OFX and maps BUYOPT/SELLOPT plus
stock buys/sells into GammaLedger legs. The supplied Interactive Brokers sample
is XML-compatible after the OFX header, so this parser uses structured XML and
keeps unsupported cash/dividend activity out of the trade import.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date
from typing import Any


@dataclass(frozen=True, slots=True)
class SecurityInfo:
    unique_id: str
    ticker: str
    underlying: str
    type: str
    option_type: str | None = None
    strike: float | None = None
    expiration: date | None = None
    multiplier: float = 1.0


@dataclass(frozen=True, slots=True)
class ParsedTransaction:
    fitid: str
    trade_date: date
    time_key: str
    ticker: str
    order_type: str
    type: str
    quantity: float
    multiplier: float
    strike: float | None
    premium: float
    fees: float
    expiration: date | None
    underlying_type: str
    group_key: str


def parse_ofx_export(content: str) -> dict[str, Any]:
    """Return a GammaLedger JSON export envelope parsed from OFX content."""
    root = ET.fromstring(_xml_payload(content))
    securities = _extract_securities(root)
    transactions = _extract_transactions(root, securities)
    trades = _build_trades(transactions)
    return {
        "version": "2.5",
        "timestamp": _dtasof(root),
        "fileName": "ofx-import.ofx",
        "trades": trades,
    }


def _xml_payload(content: str) -> str:
    start = content.find("<OFX>")
    if start < 0:
        raise ValueError("OFX payload is missing <OFX> root")
    return content[start:]


def _extract_securities(root: ET.Element) -> dict[str, SecurityInfo]:
    securities: dict[str, SecurityInfo] = {}
    for stock in root.findall(".//STOCKINFO"):
        unique_id = _required_text(stock, "SECINFO/SECID/UNIQUEID")
        ticker = _required_text(stock, "SECINFO/TICKER").strip().upper()
        securities[unique_id] = SecurityInfo(
            unique_id=unique_id,
            ticker=ticker,
            underlying=ticker,
            type="STOCK",
            multiplier=1.0,
        )
    for option in root.findall(".//OPTINFO"):
        unique_id = _required_text(option, "SECINFO/SECID/UNIQUEID")
        ticker = _required_text(option, "SECINFO/TICKER").strip().upper()
        underlying = _underlying_from_contract(ticker)
        option_type = _required_text(option, "OPTTYPE").strip().upper()
        securities[unique_id] = SecurityInfo(
            unique_id=unique_id,
            ticker=ticker,
            underlying=underlying,
            type=option_type,
            option_type=option_type,
            strike=_float(_required_text(option, "STRIKEPRICE")),
            expiration=_ofx_date(_required_text(option, "DTEXPIRE")),
            multiplier=_float(_text(option, "SHPERCTRCT") or "100"),
        )
    return securities


def _extract_transactions(
    root: ET.Element, securities: dict[str, SecurityInfo]
) -> list[ParsedTransaction]:
    rows: list[ParsedTransaction] = []
    for element in root.findall(".//INVTRANLIST/*"):
        if element.tag not in {"BUYOPT", "SELLOPT", "BUYSTOCK", "SELLSTOCK"}:
            continue
        buy = element.find("INVBUY")
        sell = element.find("INVSELL")
        body = buy if buy is not None else sell
        if body is None:
            continue
        unique_id = _required_text(body, "SECID/UNIQUEID")
        security = securities.get(unique_id)
        if security is None:
            continue
        fitid = _safe_id(_required_text(body, "INVTRAN/FITID"))
        trade_datetime = _required_text(body, "INVTRAN/DTTRADE")
        trade_date = _ofx_date(trade_datetime)
        time_key = trade_datetime[:14]
        quantity = abs(_float(_required_text(body, "UNITS")))
        price = abs(_float(_required_text(body, "UNITPRICE")))
        fees = abs(_float(_text(body, "COMMISSION") or "0"))
        order_type = _order_type(element)
        leg_type = security.option_type or "STOCK"
        group_key = "|".join(
            [
                trade_datetime,
                security.underlying,
                security.expiration.isoformat() if security.expiration else "STOCK",
            ]
        )
        rows.append(
            ParsedTransaction(
                fitid=fitid,
                trade_date=trade_date,
                time_key=time_key,
                ticker=security.underlying,
                order_type=order_type,
                type=leg_type,
                quantity=quantity,
                multiplier=security.multiplier,
                strike=security.strike if leg_type != "STOCK" else price,
                premium=price if leg_type != "STOCK" else 0.0,
                fees=fees,
                expiration=security.expiration,
                underlying_type=_underlying_type(security.underlying),
                group_key=group_key,
            )
        )
    return rows


def _build_trades(transactions: list[ParsedTransaction]) -> list[dict[str, Any]]:
    groups: dict[str, list[ParsedTransaction]] = {}
    for transaction in transactions:
        groups.setdefault(transaction.group_key, []).append(transaction)

    trades: list[dict[str, Any]] = []
    for index, rows in enumerate(
        sorted(groups.values(), key=lambda items: items[0].group_key), start=1
    ):
        first = rows[0]
        trade_id = f"TRD-OFX-{first.trade_date.strftime('%Y%m%d')}-{index:04d}"
        strategy = _infer_strategy(rows)
        expiration = max((row.expiration for row in rows if row.expiration), default=None)
        opened = min(row.trade_date for row in rows)
        closed = max(
            (row.trade_date for row in rows if row.order_type in {"BTC", "STC"}),
            default=None,
        )
        legs = []
        for leg_index, row in enumerate(rows, start=1):
            legs.append(
                {
                    "id": f"{trade_id}-L{leg_index}",
                    "orderType": row.order_type,
                    "type": row.type,
                    "quantity": row.quantity,
                    "multiplier": row.multiplier,
                    "executionDate": row.trade_date.isoformat(),
                    "expirationDate": row.expiration.isoformat() if row.expiration else None,
                    "strike": row.strike,
                    "premium": row.premium,
                    "fees": row.fees,
                    "underlyingType": row.underlying_type,
                    "externalId": row.fitid,
                    "importGroupId": first.group_key,
                    "importSource": "OFX",
                    "importBatchId": "OFX",
                    "tickerSymbol": row.ticker,
                }
            )
        trades.append(
            {
                "id": trade_id,
                "ticker": first.ticker,
                "strategy": strategy,
                "underlyingType": first.underlying_type,
                "status": "Closed"
                if closed and all(r.order_type in {"BTC", "STC"} for r in rows)
                else "Open",
                "openedDate": opened.isoformat(),
                "closedDate": closed.isoformat() if closed else None,
                "expirationDate": expiration.isoformat() if expiration else None,
                "notes": "Imported from OFX",
                "legs": legs,
            }
        )
    return trades


def _infer_strategy(rows: list[ParsedTransaction]) -> str:
    option_rows = [row for row in rows if row.type in {"CALL", "PUT"}]
    stock_rows = [row for row in rows if row.type == "STOCK"]
    if stock_rows and any(row.type == "CALL" and row.order_type == "STO" for row in option_rows):
        return "Covered Call"
    if len(option_rows) == 1:
        row = option_rows[0]
        if row.type == "PUT" and row.order_type == "STO":
            return "Cash-Secured Put"
        if row.type == "CALL" and row.order_type == "STO":
            return "Short Call"
        return f"{'Long' if row.order_type == 'BTO' else 'Short'} {row.type.title()}"
    if len({row.type for row in option_rows}) == 1 and len(option_rows) == 2:
        side = next(iter({row.type for row in option_rows}))
        if side == "PUT":
            return (
                "Bull Put Spread"
                if any(row.order_type == "STO" for row in option_rows)
                else "Bear Put Spread"
            )
        return (
            "Bear Call Spread"
            if any(row.order_type == "STO" for row in option_rows)
            else "Bull Call Spread"
        )
    if len(option_rows) >= 4 and {row.type for row in option_rows} == {"CALL", "PUT"}:
        return "Iron Condor"
    if stock_rows:
        return "Long Stock"
    return "Custom"


def _order_type(element: ET.Element) -> str:
    if element.tag == "BUYOPT":
        return "BTC" if (_text(element, "OPTBUYTYPE") or "").upper() == "BUYTOCLOSE" else "BTO"
    if element.tag == "SELLOPT":
        return "STC" if (_text(element, "OPTSELLTYPE") or "").upper() == "SELLTOCLOSE" else "STO"
    if element.tag == "BUYSTOCK":
        return "BTC" if (_text(element, "BUYTYPE") or "").upper() == "BUYTOCOVER" else "BTO"
    sell_type = (_text(element, "SELLTYPE") or "").upper()
    return "STO" if sell_type == "SELLSHORT" else "STC"


def _underlying_from_contract(ticker: str) -> str:
    match = re.match(r"^([A-Z.]{1,6})\s+", ticker)
    return (match.group(1) if match else ticker.split()[0]).replace(".", "-")


def _underlying_type(ticker: str) -> str:
    return "Index" if ticker in {"SPX", "NDX", "RUT", "VIX"} else "Stock"


def _dtasof(root: ET.Element) -> str:
    value = _text(root, ".//DTASOF") or _text(root, ".//DTSERVER")
    if not value:
        return date.today().isoformat()
    parsed = _ofx_date(value)
    return parsed.isoformat()


def _ofx_date(value: str) -> date:
    compact = value.strip()[:8]
    return date(int(compact[:4]), int(compact[4:6]), int(compact[6:8]))


def _safe_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", value)


def _float(value: str) -> float:
    return float(value.strip())


def _required_text(element: ET.Element, path: str) -> str:
    value = _text(element, path)
    if value is None:
        raise ValueError(f"OFX element missing required field: {path}")
    return value


def _text(element: ET.Element, path: str) -> str | None:
    found = element.find(path)
    if found is None or found.text is None:
        return None
    return found.text.strip()
