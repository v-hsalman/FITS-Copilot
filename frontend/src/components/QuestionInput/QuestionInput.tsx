import { useRef, useState } from 'react'

import { Stack } from '@fluentui/react'
import { Button, Tooltip, Divider } from '@fluentui/react-components'
import { Send48Filled, MicRecordFilled, Mic48Filled, BroomFilled, AddFilled } from '@fluentui/react-icons'

import * as sdk from 'microsoft-cognitiveservices-speech-sdk'

import styles from './QuestionInput.module.css'

import { fetchSpeechToken } from '../../api'

interface Props {
  onSend: (question: string) => void
  disabled: boolean
  clearOnSend?: boolean
  onNewChat: () => void
  onClearChat: () => void
  chatState: boolean
}

type microphoneState = 'ready' | 'awaiting' | 'recording'

export const QuestionInput = ({ onSend, disabled, clearOnSend, onNewChat, onClearChat, chatState }: Props) => {
  const [question, setQuestion] = useState<string>('')
  const [micState, setMicState] = useState<microphoneState>('ready')

  const inputRef = useRef<HTMLTextAreaElement>(null)

  const focusInput = (e: React.MouseEvent<HTMLDivElement>) => {
    e.target === e.currentTarget && inputRef.current?.focus()
  }

  const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
    if (ev.key === 'Enter' && !ev.shiftKey && !(ev.nativeEvent?.isComposing === true)) {
      ev.preventDefault()
      sendQuestion()
    }
  }

  const sendQuestion = (sttQuestion?: string) => {
    if (sttQuestion) {
      onSend(sttQuestion)
    } else {
      onSend(question)
    }

    if (clearOnSend) {
      setQuestion('')
    }
  }

  async function startSpeechToText() {
    setMicState('awaiting')
    const { token } = await fetchSpeechToken()
    if (token) {
      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, 'eastus')
      speechConfig.speechRecognitionLanguage = 'en-US'

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput()
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)

      recognizer.sessionStarted = () => {
        setMicState('recording')
      }

      recognizer.sessionStopped = () => {
        setMicState('ready')
      }

      recognizer.recognizing = (s, e) => {
        setQuestion(e.result.text)
      }

      recognizer.recognizeOnceAsync(result => {
        if (result.text) {
          sendQuestion(result.text)
        }
        setMicState('ready')
      })
    } else {
      console.error('No token found')
    }
  }

  return (
    <Stack className={styles.questionInputContainer} onClick={focusInput} placeholder="Type a new question...">
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
        <Tooltip content="Clean conversation" relationship="label">
          <Button
            onClick={onClearChat}
            appearance="subtle"
            icon={<BroomFilled />}
            disabled={chatState}
            aria-label="Clear chat button"></Button>
        </Tooltip>
        <Tooltip content="New conversation" relationship="label">
          <Button
            disabled={chatState}
            onClick={onNewChat}
            appearance="subtle"
            icon={<AddFilled />}
            aria-label="Create new chat button"></Button>
        </Tooltip>
        <Divider className={styles.inputControllsDivider} vertical />
        <Tooltip content="Use microphone" relationship="label">
          {micState === 'recording' ? (
            <Button className={styles.microphoneButton} key="mic" appearance="primary" icon={<MicRecordFilled />} />
          ) : (
            <Button
              onClick={startSpeechToText}
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
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? sendQuestion() : null)}
            onClick={() => sendQuestion()}
            disabled={question === ''}
            appearance="subtle"
            icon={<Send48Filled color="#479ef5" />}
            aria-label="Send question button"
          />
        </div>
      </Stack>
    </Stack>
  )
}
