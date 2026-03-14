import type { RefObject } from "react";

interface PageSearchInputProps {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  name: string;
  wrapperClassName?: string;
  placeholder?: string;
}

export function PageSearchInput({
  inputRef,
  value,
  onChange,
  inputClassName,
  name,
  wrapperClassName = "shrink-0",
  placeholder = "Search…"
}: PageSearchInputProps) {
  return (
    <label className={wrapperClassName}>
      <span className="sr-only">Search</span>
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        name={name}
        autoComplete="off"
        spellCheck={false}
        className={`${inputClassName} w-[18rem] transition-[width] duration-200 ease-out focus:w-[32rem] motion-reduce:transition-none`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </label>
  );
}
