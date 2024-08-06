import localVideo from '../assets/lisa-casual-sitting-idle.mp4'

type AvatarProps = {
  remoteVideoRef: React.RefObject<HTMLDivElement>
  localVideoRef: React.RefObject<HTMLVideoElement>
}

export default function Avatar(props: AvatarProps) {
  const { remoteVideoRef, localVideoRef } = props
  return (
    <>
      <div
        style={{
          width: '0.1px',
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
