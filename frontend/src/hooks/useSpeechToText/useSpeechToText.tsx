import { useState, useRef } from 'react'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import { fetchSpeechToken } from '../../api'

export type MicrophoneState = 'ready' | 'awaiting' | 'recording'

export default function useSpeechToText() {
  const [result, setResult] = useState<string>('')
  const [micState, setMicState] = useState<MicrophoneState>('ready')

  const sttToken = useRef<string | null>(null)

  const onRecognizeFunction = useRef<Function>()
  const onRecognizingFunction = useRef<Function>()

  function onRecognize(callback: Function) {
    onRecognizeFunction.current = callback
  }

  function onRecognizing(callback: Function) {
    onRecognizingFunction.current = callback
  }

  const recognizerRef = useRef<sdk.SpeechRecognizer>()

  const connectSpeechToText = async (token: string) => {
    return new Promise<void>((resolve, reject) => {
      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, 'eastus')
      speechConfig.speechRecognitionLanguage = 'en-US'

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput()
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)

      recognizerRef.current = recognizer

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
        setResult(e.result.text)
        onRecognizingFunction.current ? onRecognizingFunction.current(e.result.text) : null
      }

      recognizer.recognizeOnceAsync(result => {
        if (result.text) {
          onRecognizeFunction.current ? onRecognizeFunction.current(result.text) : null
        }
      })
    })
  }

  async function stopSpeechToText(): Promise<void> {
    recognizerRef.current?.close()
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

  return { result, micState, onRecognize, onRecognizing, startSpeechToText, stopSpeechToText }
}
