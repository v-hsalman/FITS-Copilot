import { Stack } from '@fluentui/react'
import { Button, ToggleButton, Tooltip } from '@fluentui/react-components'
import { StsControllerProps } from './types'
import { AddFilled, ChatSparkleFilled, MicFilled, MicRecordFilled } from '@fluentui/react-icons'

export default function SpeechToSpeechController({
  enableSpeechToSpeech,
  onNewChat,
  chatState,
  startSpeechToSpeech,
  stopSpeechToSpeech,
  micState,
  avatarSpeaking
}: StsControllerProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Stack
        horizontal
        style={{
          borderRadius: '4rem',
          border: '#d3d3d3 1px solid',
          paddingLeft: '1rem'
        }}>
        <Stack horizontal style={{ justifyContent: 'center', gap: '8px' }}>
          <Stack style={{ justifyContent: 'center' }}>
            <Tooltip content="New conversation" relationship="label">
              <Button
                onClick={onNewChat}
                appearance="subtle"
                icon={<AddFilled />}
                disabled={chatState}
                aria-label="Create new chat button"></Button>
            </Tooltip>
          </Stack>
          <Stack style={{ justifyContent: 'center' }}>
            <Tooltip content="Toggle speech to speech" relationship="label">
              <ToggleButton onClick={enableSpeechToSpeech} appearance="subtle" icon={<ChatSparkleFilled />} />
            </Tooltip>
          </Stack>
        </Stack>
        {micState != 'recording' && (
          <Button
            disabled={micState === 'awaiting' || avatarSpeaking}
            onClick={startSpeechToSpeech}
            shape="circular"
            appearance={'subtle'}
            style={{ maxWidth: '100%', width: '4rem', height: '4rem' }}
            icon={<MicFilled style={{ fontSize: '3rem' }} />}></Button>
        )}
        {micState === 'recording' && (
          <Button
            onClick={stopSpeechToSpeech}
            shape="circular"
            appearance={'primary'}
            style={{ maxWidth: '100%', width: '4rem', height: '4rem' }}
            icon={<MicFilled style={{ fontSize: '3rem' }} />}></Button>
        )}
      </Stack>
    </div>
  )
}
