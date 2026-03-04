import type { SearchPageSnapshot } from "./SearchPage";
import AppSelect from "./components/AppSelect";

interface SearchFiltersProps {
  availableSources: string[];
  source: string;
  onSourceChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  sort: SearchPageSnapshot["sort"];
  onSortChange: (value: SearchPageSnapshot["sort"]) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  sourceLabel: (source: string) => string;
}

export default function SearchFilters({
  availableSources,
  source,
  onSourceChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  sort,
  onSortChange,
  filtersOpen,
  onToggleFilters,
  sourceLabel,
}: SearchFiltersProps) {
  return (
    <>
      <button
        type="button"
        className="search-filters-toggle ui-btn ui-btn--secondary ui-btn--sm"
        onClick={onToggleFilters}
        aria-expanded={filtersOpen}
        aria-controls="search-filters"
      >
        Options
      </button>

      <div className="search-filters" id="search-filters" hidden={!filtersOpen}>
        <label>
          Source
          <AppSelect
            ariaLabel="Source filter"
            className="app-select"
            value={source}
            onChange={onSourceChange}
            options={[
              { value: "", label: "All" },
              ...availableSources.map((src) => ({ value: src, label: sourceLabel(src) })),
            ]}
          />
        </label>

        <label htmlFor="search-from">
          From
          <input
            id="search-from"
            className="app-date"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </label>

        <label htmlFor="search-to">
          To
          <input
            id="search-to"
            className="app-date"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </label>

        <label>
          Sort
          <AppSelect
            ariaLabel="Sort results"
            className="app-select"
            value={sort}
            onChange={(value) => onSortChange(value as SearchPageSnapshot["sort"])}
            options={[
              { value: "last_occurrence_desc", label: "Last occurrence" },
              { value: "relevance", label: "Relevance" },
              { value: "occurrence_count_desc", label: "Occurrence count" },
              { value: "title_az", label: "Title A-Z" },
              { value: "title_za", label: "Title Z-A" },
            ]}
          />
        </label>
      </div>
    </>
  );
}
