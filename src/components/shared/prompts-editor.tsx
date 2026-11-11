import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/shared/native-select'
import { PROMPT_SUGGESTIONS } from '@/lib/prompts'
import type { Prompt } from '@/services'

export function PromptsEditor({ value, onChange }: { value: Prompt[]; onChange: (value: Prompt[]) => void }) {
  const set = (index: number, patch: Partial<Prompt>) =>
    onChange(value.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)))

  return (
    <div className="grid gap-5">
      {value.map((slot, index) => (
        <div key={index} className="grid gap-2">
          <Label htmlFor={`prompt-${index}`}>
            Prompt {index + 1} {index === 2 ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
          </Label>
          <NativeSelect
            id={`prompt-${index}`}
            value={slot.prompt}
            onChange={(event) => set(index, { prompt: event.target.value })}
          >
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion}>
                {suggestion}
              </option>
            ))}
          </NativeSelect>
          <Textarea
            aria-label={`Answer ${index + 1}`}
            value={slot.answer}
            maxLength={300}
            rows={2}
            onChange={(event) => set(index, { answer: event.target.value })}
          />
        </div>
      ))}
    </div>
  )
}
