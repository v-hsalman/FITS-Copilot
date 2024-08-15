import { useRef, useState } from 'react'

import { Stack } from '@fluentui/react'
import { Button, Tooltip, Divider, Switch, ToggleButton } from '@fluentui/react-components'
import {
  Send48Filled,
  MicRecordFilled,
  Mic48Filled,
  BroomFilled,
  AddFilled,
  PersonLightningFilled
} from '@fluentui/react-icons'

import * as sdk from 'microsoft-cognitiveservices-speech-sdk'

import styles from './QuestionInput.module.css'

import { fetchSpeechToken } from '../../api'

interface Props {
  onSend: (question: string) => void
  disabled: boolean
  clearOnSend?: boolean
  onNewChat: () => void
  onClearChat: () => void
  handleSwitch: () => void
  chatState: boolean
  avatarEnabled: boolean
}

type microphoneState = 'ready' | 'awaiting' | 'recording'

const allowDeleteConversation = import.meta.env.VITE_ALLOW_USER_DELETE_CONVERSATION

export const QuestionInput = ({
  onSend,
  disabled,
  clearOnSend,
  onNewChat,
  onClearChat,
  chatState,
  handleSwitch,
  avatarEnabled
}: Props) => {
  const [question, setQuestion] = useState<string>('')
  const [micState, setMicState] = useState<microphoneState>('ready')
  const sttToken = useRef<string | null>(null)

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

  const connectSpeechToText = async (token: string) => {
    return new Promise<void>((resolve, reject) => {
      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, 'eastus')
      speechConfig.speechRecognitionLanguage = 'en-US'

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput()
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)

      recognizer.canceled = (s, e) => {
        if (e.reason === sdk.CancellationReason.Error) {
          if (e.errorCode === sdk.CancellationErrorCode.ConnectionFailure) {
            setMicState('awaiting')
            reject(new Error('Speech token invalid'))
          }
        }
      }

      recognizer.sessionStarted = () => {
        setMicState('recording')
      }

      recognizer.sessionStopped = () => {
        setMicState('ready')
        resolve()
      }

      recognizer.recognizing = (s, e) => {
        setQuestion(e.result.text)
      }

      recognizer.recognizeOnceAsync(result => {
        if (result.text) {
          sendQuestion(result.text)
        }
      })
    })
  }

  async function startSpeechToText(retry = 0): Promise<void> {
    setMicState('awaiting')
    if (sttToken.current === null) {
      const { token } = await fetchSpeechToken()
      sttToken.current = token
      await connectSpeechToText(token)
    } else {
      try {
        await connectSpeechToText(sttToken.current)
      } catch (error: any) {
        if (error.message === 'Speech token invalid') {
          if (retry < 3) {
            sttToken.current = null
            return startSpeechToText(retry + 1)
          }
        }
      }
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
    </>
  )
}
