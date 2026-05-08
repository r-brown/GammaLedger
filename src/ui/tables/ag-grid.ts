// src/ui/tables/ag-grid.ts — shared AG Grid registration for vanilla table views.

import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid as createAgGrid,
  type ColDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams,
  type RowClickedEvent,
  type SortChangedEvent
} from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule]);

function createGrid<TData>(gridRoot: HTMLElement, options: GridOptions<TData>): GridApi<TData> {
  return createAgGrid(gridRoot, {
    theme: 'legacy',
    ...options
  });
}

export {
  createGrid,
  type ColDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams,
  type RowClickedEvent,
  type SortChangedEvent
}
