import { Props } from "../QuestionInput/types";
import { MicrophoneState } from "../../hooks/useSpeechToText/useSpeechToText";

export type StsControllerProps = Pick<Props, "enableSpeechToSpeech" | "onNewChat" | "chatState"> & {
    avatarSpeaking:boolean;
    micState: MicrophoneState;  
    startSpeechToSpeech: () => void;
    stopSpeechToSpeech: () => Promise<void>;
}