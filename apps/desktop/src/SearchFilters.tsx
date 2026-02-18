import type { SearchPageSnapshot } from "./SearchPage";

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
        className="search-filters-toggle"
        onClick={onToggleFilters}
        aria-expanded={filtersOpen}
        aria-controls="search-filters"
      >
        Options
      </button>

      <div className="search-filters" id="search-filters" hidden={!filtersOpen}>
        <label htmlFor="search-source">
          Source
          <select
            id="search-source"
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
          >
            <option value="">All</option>
            {availableSources.map((src) => (
              <option key={src} value={src}>
                {sourceLabel(src)}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="search-from">
          From
          <input
            id="search-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </label>

        <label htmlFor="search-to">
          To
          <input
            id="search-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </label>

        <label htmlFor="search-sort">
          Sort
          <select
            id="search-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SearchPageSnapshot["sort"])}
          >
            <option value="last_occurrence_desc">Last occurrence</option>
            <option value="relevance">Relevance</option>
            <option value="occurrence_count_desc">Occurrence count</option>
            <option value="title_az">Title A-Z</option>
            <option value="title_za">Title Z-A</option>
          </select>
        </label>
      </div>
    </>
  );
}

