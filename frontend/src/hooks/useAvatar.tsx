import { useState, useEffect, useRef, useCallback } from 'react'
import {
  AvatarSynthesizer,
  AvatarVideoFormat,
  SpeechConfig,
  AvatarConfig,
  ResultReason
} from 'microsoft-cognitiveservices-speech-sdk'

const speechSubscriptionKey = import.meta.env.VITE_SPEECH_SUBSCRIPTION_KEY

export type AvatarProperties = {
  remoteAvatarRef: HTMLDivElement | null
  localAvatarRef: HTMLVideoElement | null
  isSpeaking: boolean
  sessionActive: boolean
  avatarSynthesizerState: AvatarSynthesizer | undefined
}

export default function useAvatar() {
  const [avatarSynthesizerState, setAvatarSynthesizerState] = useState<AvatarSynthesizer>()
  const avatarSynthesizerRef = useRef<AvatarSynthesizer>()
  const [avatar, setAvatar] = useState<AvatarProperties>({
    avatarSynthesizerState: undefined,
    remoteAvatarRef: null,
    localAvatarRef: null,
    isSpeaking: false,
    sessionActive: false
  })

  const onEndOfSpeechRef = useRef<Function>()

  useEffect(() => {
    avatarSynthesizerRef.current = avatarSynthesizerState
  }, [avatarSynthesizerState])

  const updateVideoRefs = (
    remoteVideoRef: React.MutableRefObject<HTMLDivElement | null>,
    localVideoRef: React.MutableRefObject<HTMLVideoElement | null>
  ) => {
    setAvatar(prevAvatar => {
      return { ...prevAvatar, remoteAvatarRef: remoteVideoRef.current, localAvatarRef: localVideoRef.current }
    })
  }

  const onEndOfSpeech = (callback: Function) => {
    onEndOfSpeechRef.current = callback
  }

  const stopAvatarSpeech = useCallback(async () => {
    await avatarSynthesizerState?.stopSpeakingAsync()
    disconnectAvatar()
  }, [avatar])

  const disconnectAvatar = useCallback(() => {
    try {
      avatarSynthesizerRef.current?.close()
      setAvatar(prevAvatar => {
        return { ...prevAvatar, isSpeaking: false, sessionActive: false }
      })
    } catch (err) {
      console.log('Failed to disconnect avatar. Error: ' + err)
    }
  }, [avatar])

  const connectAvatar = useCallback(async () => {
    try {
      const speechConfig = SpeechConfig.fromSubscription(speechSubscriptionKey, 'westus2')
      speechConfig.speechSynthesisLanguage = 'en-US'
      speechConfig.speechSynthesisVoiceName = 'en-US-AvaMultilingualNeural'

      const videoFormat = new AvatarVideoFormat()
      const avatarConfig = new AvatarConfig('lisa', 'casual-sitting', videoFormat)

      let avatarSynthesizer = new AvatarSynthesizer(speechConfig, avatarConfig)
      setAvatarSynthesizerState(avatarSynthesizer)

      const getIceCretdentials = await fetch(
        'https://westus2.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1',
        {
          method: 'GET',
          headers: {
            'Ocp-Apim-Subscription-Key': speechSubscriptionKey
          }
        }
      )
      const iceCretdentials = await getIceCretdentials.json()

      let peerConnection = new RTCPeerConnection({
        iceServers: [
          {
            urls: iceCretdentials.Urls,
            username: iceCretdentials.Username,
            credential: iceCretdentials.Password
          }
        ]
      })

      peerConnection.ontrack = function (event) {
        if (event.track.kind === 'audio') {
          let audioElement = document.createElement('audio')
          audioElement.id = 'audioPlayer'
          audioElement.srcObject = event.streams[0]
          audioElement.autoplay = true

          audioElement.onplaying = () => {
            console.log(`Playing audio track`)
          }
          avatar.remoteAvatarRef?.appendChild(audioElement)
        }

        if (event.track.kind === 'video') {
          let videoElement = document.createElement('video')
          videoElement.id = 'videoPlayer'
          videoElement.srcObject = event.streams[0]
          videoElement.autoplay = true
          videoElement.playsInline = true

          videoElement.onplaying = () => {
            if (avatar.remoteAvatarRef?.childNodes) {
              for (var i = 0; i < avatar.remoteAvatarRef.childNodes.length; i++) {
                if ((avatar.remoteAvatarRef?.childNodes[i] as Element).localName === event.track.kind) {
                  avatar.remoteAvatarRef?.removeChild(avatar.remoteAvatarRef?.childNodes[i])
                }
              }
            }

            avatar.remoteAvatarRef?.appendChild(videoElement)
            if (avatar.localAvatarRef) avatar.localAvatarRef.hidden = true
            if (avatar.remoteAvatarRef) avatar.remoteAvatarRef.style.width = '40%'
            videoElement.style.width = '100%'
            videoElement.style.height = '100%'
            videoElement.style.objectFit = 'cover'
            setAvatar(prevAvatar => {
              return {
                ...prevAvatar,
                sessionActive: true
              }
            })
          }
        }
      }

      peerConnection.oniceconnectionstatechange = e => {
        console.log('WebRTC status: ' + peerConnection.iceConnectionState)
      }

      peerConnection.addTransceiver('video', { direction: 'sendrecv' })
      peerConnection.addTransceiver('audio', { direction: 'sendrecv' })

      const avatarStart = await avatarSynthesizer.startAvatarAsync(peerConnection)

      if (avatarStart.reason === ResultReason.SynthesizingAudioCompleted) {
        console.log('[' + new Date().toISOString() + '] Avatar started. Result ID: ' + avatarStart.resultId)
      } else {
        if (avatarStart.reason === ResultReason.Canceled) {
          console.log('Unable to start avatar: ' + avatarStart.errorDetails)
        }
      }

      peerConnection.oniceconnectionstatechange = e => {
        console.log('WebRTC status: ' + peerConnection.iceConnectionState)
      }
    } catch (err) {
      console.log('Failed to speak. Error: ' + err)
    }
  }, [avatar])

  const speak = useCallback(
    async (text: string) => {
      return new Promise<void>(async (resolve, reject) => {
        if (avatar.sessionActive === false) {
          await connectAvatar()
        }
        try {
          setAvatar({ ...avatar, isSpeaking: true })
          resolve()
          const result = await avatarSynthesizerRef.current?.speakTextAsync(text)
          if (result?.reason === ResultReason.SynthesizingAudioCompleted) {
            if (onEndOfSpeechRef.current) onEndOfSpeechRef.current()
            console.log('Speech and avatar synthesized to video stream:')
            disconnectAvatar()
          } else {
            reject(new Error('Unable to speak. ' + result?.errorDetails))
          }
          setAvatar(prevAvatar => {
            return { ...prevAvatar, isSpeaking: false }
          })
        } catch (err) {
          reject(new Error('Failed to speak. Error: ' + err))
        }
      })
    },
    [avatar]
  )
  return { speak, connectAvatar, disconnectAvatar, updateVideoRefs, avatar, setAvatar, stopAvatarSpeech, onEndOfSpeech }
}
