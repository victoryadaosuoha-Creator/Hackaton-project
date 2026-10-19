import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { DraftReport, LocalAttachment } from '@/data/types'
import { inspectImageFile } from '@/utils/validation'

type Props = {
  draft: DraftReport
  onChange: (patch: Partial<DraftReport>) => void
}

export function EvidenceFields({ draft, onChange }: Props) {
  const [fileError, setFileError] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)

  async function onFile(file: File | undefined) {
    setFileError(null)
    if (!file) return
    const problem = await inspectImageFile(file)
    if (problem) {
      setFileError(problem)
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(file)
    })
    const attachment: LocalAttachment = {
      name: file.name,
      mime: file.type,
      size: file.size,
      dataUrl,
      uploadedToStorage: false,
    }
    onChange({ attachment })
  }

  async function toggleVoice() {
    setVoiceError(null)
    if (recording) {
      setRecording(false)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('This browser cannot record audio. Continue with a written report.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const started = Date.now()
      recorder.start()
      setRecording(true)
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop()
      }, 8000)
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        onChange({ voiceDurationSeconds: Math.max(1, Math.round((Date.now() - started) / 1000)) })
      }
    } catch {
      setVoiceError('Microphone permission was denied. The written report workflow remains usable.')
      setRecording(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="photo" className="block text-sm font-semibold text-brand-900">
          Photograph (optional)
        </label>
        <input
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 block w-full text-sm"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <p className="mt-1 text-xs text-muted">
          JPEG, PNG or WebP, maximum 5 MB. Persistent Supabase Storage is not enabled in this build, so the file stays
          on this device.
        </p>
        {fileError ? <p className="text-xs font-medium text-red-700">{fileError}</p> : null}
        {draft.attachment ? (
          <p className="mt-1 text-xs font-semibold text-amber-800">
            {draft.attachment.name} is local only and has not been uploaded.
          </p>
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold text-brand-900">Voice note (device-local)</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => void toggleVoice()}>
          {recording ? 'Recording… tap to stop' : 'Record a short sample'}
        </Button>
        {draft.voiceDurationSeconds ? (
          <p className="mt-1 text-xs text-muted">Local recording length: {draft.voiceDurationSeconds}s. Not uploaded.</p>
        ) : null}
        {voiceError ? <p className="mt-1 text-xs font-medium text-red-700">{voiceError}</p> : null}
      </div>
    </div>
  )
}
