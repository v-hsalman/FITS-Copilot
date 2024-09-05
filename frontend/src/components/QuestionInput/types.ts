import { MicrophoneState } from "../../hooks/useSpeechToText/useSpeechToText"

export type Props = {
    disabled: boolean
    clearOnSend?: boolean
    onNewChat: () => void
    onClearChat: () => void
    handleSwitch: () => void
    enableSpeechToSpeech: () => void
    sendQuestion: () => void    
    setQuestion: (question: string) => void
    startSpeechToText: () => void
    chatState: boolean
    avatarEnabled: boolean
    question: string    
    micState: MicrophoneState
}