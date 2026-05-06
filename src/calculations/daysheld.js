// src/calculations/daysheld.js — Wave 3: Days held and DTE helpers.
// Uses the .call(this, …) delegation pattern.

// Fixed days held calculation
export function calculateDaysHeld(trade) {
    if (!trade) {
        return 0;
    }

    const entryDate = this.parseDateValue(trade.entryDate || trade.openedDate);
    if (!entryDate) {
        return 0;
    }

    const exitCandidate = this.parseDateValue(trade.exitDate || trade.closedDate);
    const endDate = (this.isClosedStatus(trade.status) && exitCandidate) ? exitCandidate : this.currentDate;

    const diffTime = endDate.getTime() - entryDate.getTime();
    if (!Number.isFinite(diffTime) || diffTime < 0) {
        return 0;
    }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
}

// DTE calculation using current date
export function calculateDTE(expirationDate, trade) {
    let expDate = this.parseDateValue(expirationDate);

    if (!expDate && this.isPmccTrade(trade)) {
        const pmccExpiration = this.parseDateValue(trade?.pmccShortExpiration);
        if (pmccExpiration) {
            expDate = pmccExpiration;
        }
    }

    if (!expDate) {
        return 0;
    }

    if (this.isClosedStatus(trade.status)) {
        return 0;
    }

    const diffTime = expDate.getTime() - this.currentDate.getTime();
    if (!Number.isFinite(diffTime)) {
        return 0;
    }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}
