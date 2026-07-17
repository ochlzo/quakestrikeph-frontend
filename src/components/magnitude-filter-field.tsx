import * as React from "react"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  MAGNITUDE_RANGE_OPTIONS,
  parseCustomMagnitudeRanges,
} from "@/lib/magnitude-ranges"
import { sanitizeMagnitudeRangeInput } from "@/lib/input-security"

const PRESET_VALUES = MAGNITUDE_RANGE_OPTIONS.map((option) => option.value)
const OPTION_BY_VALUE = new Map<string, (typeof MAGNITUDE_RANGE_OPTIONS)[number]>(
  MAGNITUDE_RANGE_OPTIONS.map((option) => [option.value, option])
)

export function MagnitudeFilterField({
  value,
  onValueChange,
  invalid,
}: {
  value: string[]
  onValueChange: (value: string[]) => void
  invalid?: boolean
}) {
  const anchor = useComboboxAnchor()
  const [inputValue, setInputValue] = React.useState("")
  const [inputError, setInputError] = React.useState<string>()

  function addCustomRanges() {
    const result = parseCustomMagnitudeRanges(inputValue)
    if (result.error) {
      setInputError(result.error)
      return
    }

    onValueChange([...new Set([...value, ...result.values])])
    setInputValue("")
    setInputError(undefined)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Select color bands or type ranges like 1-2, 3-4, then press Enter.
      </p>
      <Combobox
        items={PRESET_VALUES}
        multiple
        value={value}
        onValueChange={(nextValue) => onValueChange(nextValue)}
        inputValue={inputValue}
        onInputValueChange={(nextValue) => {
          setInputValue(sanitizeMagnitudeRangeInput(nextValue))
          setInputError(undefined)
        }}
        itemToStringLabel={(item) => OPTION_BY_VALUE.get(item)?.label ?? item}
      >
        <ComboboxChips ref={anchor} aria-invalid={invalid || Boolean(inputError)}>
          <ComboboxValue>
            {value.map((item) => {
              const option = OPTION_BY_VALUE.get(item)
              return (
                <ComboboxChip key={item}>
                  {option ? <span className={`size-2 rounded-full ${option.colorClass}`} /> : null}
                  {option?.label ?? item}
                </ComboboxChip>
              )
            })}
          </ComboboxValue>
          <ComboboxChipsInput
            aria-label="Magnitude ranges"
            placeholder={value.length ? "Add range" : "Select or type ranges"}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !inputValue.trim().match(/\d\s*-/)) return
              event.preventDefault()
              addCustomRanges()
            }}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>Type a custom range and press Enter.</ComboboxEmpty>
          <ComboboxList>
            {(item) => {
              const option = OPTION_BY_VALUE.get(item)
              return option ? (
                <ComboboxItem key={item} value={item}>
                  <span className={`size-2 rounded-full ${option.colorClass}`} />
                  {option.label}
                </ComboboxItem>
              ) : null
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {inputError ? <p role="alert" className="text-xs text-destructive">{inputError}</p> : null}
    </div>
  )
}
