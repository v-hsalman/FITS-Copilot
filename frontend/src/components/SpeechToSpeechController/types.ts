import { Props } from "../QuestionInput/types";
import { MicrophoneState } from "../../hooks/useSpeechToText/useSpeechToText";

export type StsControllerProps = Pick<Props, "toggleSpeechToSpeech" | "onNewChat" > & {
    disabled: boolean;
    avatarSpeaking:boolean;
    micState: MicrophoneState;  
    startSpeechToSpeech: () => void;
    stopSpeechToSpeech: () => Promise<void>;
}