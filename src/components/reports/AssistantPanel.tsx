import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Field'
import type { ReportCategory } from '@/data/types'
import { draftAssistantReply } from '@/services/assistant'

type Props = {
  onApprove: (suggestion: { category?: ReportCategory; title?: string; summary?: string }) => void
}

export function AssistantPanel({ onApprove }: Props) {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState<ReturnType<typeof draftAssistantReply> | null>(null)
  const [approved, setApproved] = useState(false)

  return (
    <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-4">
      <p className="text-sm font-bold text-brand-900">Complaint assistant (scripted demo)</p>
      <p className="mt-1 text-xs text-muted">
        Suggestions are keyword rules, not a connected AI model. They are not applied until you approve them.
      </p>
      <TextArea
        id="assistant-input"
        className="mt-3"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Describe the problem in your own words…"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setApproved(false)
            setReply(draftAssistantReply(message))
          }}
        >
          Preview suggestion
        </Button>
        <Button
          size="sm"
          disabled={!reply}
          onClick={() => {
            if (!reply) return
            onApprove(reply)
            setApproved(true)
          }}
        >
          Approve and apply
        </Button>
      </div>
      {reply ? (
        <div className="mt-3 rounded-xl bg-white p-3 text-sm text-brand-900">
          <p>{reply.reply}</p>
          {approved ? <p className="mt-2 text-xs font-semibold text-brand-700">Suggestion applied to the form. You can still edit every field.</p> : null}
        </div>
      ) : null}
    </div>
  )
}
