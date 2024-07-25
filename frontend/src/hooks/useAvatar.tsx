import { forwardRef, useState, useEffect, useRef } from 'react'
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'
import localVideo from '../assets/lisa-casual-sitting-idle.mp4'

const speechSubscriptionKey = import.meta.env.VITE_SPEECH_SUBSCRIPTION_KEY

export default function useAvatar() {
  const [avatarSynthesizerState, setAvatarSynthesizerState] = useState<SpeechSDK.AvatarSynthesizer | null>(null)
  const [avatarSpeaking, setAvatarSpeaking] = useState(false)

  const disconnectAvatar = async () => {
    try {
      setAvatarSpeaking(false)
      await avatarSynthesizerState?.stopAvatarAsync()
    } catch (err) {
      console.log('Failed to disconnect avatar. Error: ' + err)
    }
  }

  const speak = async (text: string, avatarVideoRef: any) => {
    try {
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechSubscriptionKey, 'westus2')
      speechConfig.speechSynthesisLanguage = 'en-US'
      speechConfig.speechSynthesisVoiceName = 'en-US-AvaMultilingualNeural'

      const videoFormat = new SpeechSDK.AvatarVideoFormat()
      const avatarConfig = new SpeechSDK.AvatarConfig('lisa', 'casual-sitting', videoFormat)

      let avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig)
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

          avatarVideoRef.current.appendChild(audioElement)
        }

        if (event.track.kind === 'video') {
          let videoElement = document.createElement('video')
          videoElement.id = 'videoPlayer'
          videoElement.srcObject = event.streams[0]
          videoElement.autoplay = true
          videoElement.playsInline = true

          videoElement.onplaying = () => {
            for (var i = 0; i < avatarVideoRef.current.childNodes.length; i++) {
              if (avatarVideoRef.current.childNodes[i].localName === event.track.kind) {
                avatarVideoRef.current.removeChild(avatarVideoRef.current.childNodes[i])
              }
            }

            avatarVideoRef.appendChild(videoElement)
            console.log(`Video track connected`)
          }
        }
      }

      peerConnection.oniceconnectionstatechange = e => {
        if (peerConnection.iceConnectionState === 'failed' || 'disconnected' || 'closed') {
          disconnectAvatar()
        }
        if (peerConnection.iceConnectionState === 'connected') {
          setAvatarSpeaking(true)
        }
        console.log('WebRTC status: ' + peerConnection.iceConnectionState)
      }

      peerConnection.addTransceiver('video', { direction: 'sendrecv' })
      peerConnection.addTransceiver('audio', { direction: 'sendrecv' })

      const avatarStart = await avatarSynthesizer.startAvatarAsync(peerConnection)

      if (avatarStart.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log('[' + new Date().toISOString() + '] Avatar started. Result ID: ' + avatarStart.resultId)
      } else {
        if (avatarStart.reason === SpeechSDK.ResultReason.Canceled) {
          console.log('Unable to start avatar: ' + avatarStart.errorDetails)
        }
      }

      const result = await avatarSynthesizer.speakTextAsync(text)
      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log('Speech and avatar synthesized to video stream:')
      } else {
        console.log('Unable to speak. Result ID: ' + result.resultId)
        console.log('Error: ' + result.errorDetails)
      }
      await disconnectAvatar()
    } catch (err) {
      console.log('Failed to speak. Error: ' + err)
      await disconnectAvatar()
    }
  }

  const Avatar = forwardRef<HTMLDivElement, {}>(function Avatar(props, ref) {
    return (
      <>
        <div
          id="AvatarVideo"
          ref={ref}
          style={{ display: avatarSpeaking ? 'visible' : 'none', height: '100%', width: '30%', objectFit: 'cover' }}>
          Avatar
        </div>
        <video
          muted
          autoPlay
          loop
          style={{
            display: avatarSpeaking ? 'none' : 'visible',
            height: '100%',
            width: '30%',
            objectFit: 'cover'
          }}>
          <source src={localVideo} type="video/mp4" />
        </video>
      </>
    )
  })

  return { Avatar, speak, disconnectAvatar }
}
