import localVideo from '../assets/lisa-casual-sitting-idle.mp4'
import { AvatarProperties } from './useAvatar'

type AvatarProps = {
  remoteVideoRef: React.RefObject<HTMLDivElement>
  localVideoRef: React.RefObject<HTMLVideoElement>
  avatar: AvatarProperties
}

export default function Avatar(props: AvatarProps) {
  const { remoteVideoRef, localVideoRef, avatar } = props
  return (
    <>
      <div
        style={{
          width: avatar.isSpeaking || avatar.sessionActive ? '30%' : '0.1px',
          height: '100%',
          objectFit: 'cover'
        }}
        id="AvatarVideo"
        ref={remoteVideoRef}></div>
      <video
        muted
        ref={localVideoRef}
        autoPlay
        loop
        hidden={avatar.isSpeaking || avatar.sessionActive}
        style={{
          height: '100%',
          width: '30%',
          objectFit: 'cover'
        }}>
        <source src={localVideo} type="video/mp4" />
      </video>
    </>
  )
}
