import { MicrophoneState } from "../../hooks/useSpeechToText/useSpeechToText"

export type Props = {
    onSend: () => void
    disabled: boolean
    clearOnSend?: boolean
    onNewChat: () => void
    onClearChat: () => void
    handleSwitch: () => void
    setQuestion: (question: string) => void
    startSpeechToText: () => void
    avatarEnabled: boolean
    question: string    
    micState: MicrophoneState
    toggleSpeechToSpeech: () => void
}