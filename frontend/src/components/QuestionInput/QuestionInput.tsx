import { useRef, useState } from 'react'

import { Stack } from '@fluentui/react'
import { Button, Tooltip, Divider, Switch, ToggleButton } from '@fluentui/react-components'
import {
  Send48Filled,
  MicRecordFilled,
  Mic48Filled,
  BroomFilled,
  AddFilled,
  PersonLightningFilled,
  ChatSparkleFilled
} from '@fluentui/react-icons'

import styles from './QuestionInput.module.css'

interface Props {
  onSend: (question?: string) => void
  disabled: boolean
  clearOnSend?: boolean
  onNewChat: () => void
  onClearChat: () => void
  handleSwitch: () => void
  chatState: boolean
  avatarEnabled: boolean
  startSpeechToText: () => void
  setQuestion: (question: string) => void
  question: string
  micState: 'ready' | 'awaiting' | 'recording'
  toggleSpeechToSpeech: () => void
}

const allowDeleteConversation = import.meta.env.VITE_ALLOW_USER_DELETE_CONVERSATION

export const QuestionInput = ({
  onSend,
  disabled,
  onNewChat,
  onClearChat,
  chatState,
  handleSwitch,
  avatarEnabled,
  startSpeechToText,
  setQuestion,
  question,
  micState,
  toggleSpeechToSpeech
}: Props) => {
  const sttToken = useRef<string | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)

  const focusInput = (e: React.MouseEvent<HTMLDivElement>) => {
    e.target === e.currentTarget && inputRef.current?.focus()
  }

  const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
    if (ev.key === 'Enter' && !ev.shiftKey && !(ev.nativeEvent?.isComposing === true)) {
      ev.preventDefault()
      onSend()
    }
  }

  return (
    <>
      <Stack className={styles.questionInputContainer} onClick={focusInput}>
        <textarea
          disabled={disabled || micState === 'recording'}
          ref={inputRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={onEnterPress}
          className={styles.questionInput}
          placeholder="Type a new question..."
        />
        <Stack className={styles.inputControlls}>
          {allowDeleteConversation === 'true' && (
            <Tooltip content="Clean conversation" relationship="label">
              <Button
                onClick={onClearChat}
                appearance="subtle"
                icon={<BroomFilled />}
                disabled={chatState}
                aria-label="Clear chat button"></Button>
            </Tooltip>
          )}
          <Tooltip content="New conversation" relationship="label">
            <Button
              disabled={chatState}
              onClick={onNewChat}
              appearance="subtle"
              icon={<AddFilled />}
              aria-label="Create new chat button"></Button>
          </Tooltip>
          <Divider className={styles.inputControllsDivider} vertical />
          <Tooltip content="Toggle avatar" relationship="label">
            <ToggleButton
              checked={avatarEnabled}
              onClick={handleSwitch}
              appearance="subtle"
              icon={<PersonLightningFilled />}
            />
          </Tooltip>
          <Tooltip content="Toggle speech to speech" relationship="label">
            <ToggleButton onClick={toggleSpeechToSpeech} appearance="subtle" icon={<ChatSparkleFilled />} />
          </Tooltip>
          <Divider className={styles.inputControllsDivider} vertical />
          <Tooltip content="Use microphone" relationship="label">
            {micState === 'recording' ? (
              <Button className={styles.microphoneButton} key="mic" appearance="primary" icon={<MicRecordFilled />} />
            ) : (
              <Button
                onClick={() => startSpeechToText()}
                disabled={micState === 'awaiting'}
                className={styles.microphoneButton}
                appearance="subtle"
                icon={<Mic48Filled />}
                aria-label="Use microphone button"
              />
            )}
          </Tooltip>
          <div className={question === '' ? styles.sendButton : styles.sendButtonActive}>
            <Button
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? onSend() : null)}
              onClick={() => onSend()}
              disabled={question === ''}
              appearance="subtle"
              icon={<Send48Filled color="#479ef5" />}
              aria-label="Send question button"
            />
          </div>
        </Stack>
      </Stack>
    </>
  )
}
