"use client";

import { motion } from "framer-motion";

const FILTERS = [
  { id: "all", label: "all" },
  { id: "clips", label: "clips" },
  { id: "pics", label: "pics" },
  { id: "notes", label: "notes" },
];

interface FeedFilterProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const FeedFilter = ({ activeFilter, onFilterChange }: FeedFilterProps) => {
  return (
    <div className="flex items-center gap-2 mb-0.5 bg-dark-2/40 backdrop-blur-md p-1.5 rounded-full border border-dark-4/40 w-fit mx-auto lg:mx-0 shadow-lg mt-0.5 transition-all duration-200">
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`relative px-6 py-2 text-sm font-semibold transition-all duration-300 rounded-full ${isActive ? "text-white" : "text-light-3 hover:text-white"
              }`}
          >
            {isActive && (
              <motion.div
                layoutId="active-filter"
                className="absolute inset-0 bg-primary-500 rounded-full shadow-[0_4px_15px_rgba(139,92,246,0.3)]"
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
              />
            )}
            <span className="relative z-10">{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default FeedFilter;
