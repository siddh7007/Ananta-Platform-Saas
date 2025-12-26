import { useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';

export interface Option {
  id: string;
  label: string;
}

interface AsyncAutocompleteProps {
  label: string;
  value: Option | null;
  onChange: (opt: Option | null) => void;
  loadOptions: (query: string) => Promise<Option[]>;
  placeholder?: string;
  disabled?: boolean;
  sx?: any;
}

export default function AsyncAutocomplete({
  label,
  value,
  onChange,
  loadOptions,
  placeholder,
  disabled,
  sx,
}: AsyncAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceId = useRef<number | undefined>(undefined);

  const effectiveQuery = useMemo(() => inputValue.trim(), [inputValue]);

  useEffect(() => {
    if (!open || disabled) return;
    if (debounceId.current) window.clearTimeout(debounceId.current);
    debounceId.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        const opts = await loadOptions(effectiveQuery);
        setOptions(opts);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceId.current) window.clearTimeout(debounceId.current);
    };
  }, [open, effectiveQuery, disabled, loadOptions]);

  return (
    <Autocomplete
      sx={sx}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      disabled={disabled}
      options={options}
      getOptionLabel={(o) => o.label}
      value={value}
      onChange={(_e, newVal) => onChange(newVal)}
      inputValue={inputValue}
      onInputChange={(_e, newInput) => setInputValue(newInput)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label={label}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

