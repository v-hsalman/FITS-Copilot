import { useRef, useState, useEffect, useContext, useLayoutEffect } from 'react'
import { IconButton, Dialog, DialogType, Stack, DirectionalHint } from '@fluentui/react'
import { ShieldLockRegular, ErrorCircleRegular, StopRegular, LightbulbFilamentRegular } from '@fluentui/react-icons'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import uuid from 'react-uuid'
import { isEmpty } from 'lodash'
import DOMPurify from 'dompurify'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { nord } from 'react-syntax-highlighter/dist/esm/styles/prism'

import styles from './Chat.module.css'
import FITS from '../../assets/FITS.svg'
import { XSSAllowTags } from '../../constants/sanatizeAllowables'

import {
  ChatMessage,
  ConversationRequest,
  conversationApi,
  Citation,
  ToolMessageContent,
  AzureSqlServerExecResults,
  ChatResponse,
  getUserInfo,
  Conversation,
  historyGenerate,
  historyUpdate,
  historyClear,
  ChatHistoryLoadingState,
  CosmosDBStatus,
  ErrorMessage,
  ExecResults,
  User
} from '../../api'
import { Answer } from '../../components/Answer'
import { QuestionInput } from '../../components/QuestionInput'
import { ChatHistoryPanel } from '../../components/ChatHistory/ChatHistoryPanel'
import { AppStateContext } from '../../state/AppProvider'
import { useBoolean } from '@fluentui/react-hooks'
import SpeechToSpeechController from '../../components/SpeechToSpeechController/SpeechToSpeechController'
import useSpeechToText from '../../hooks/useSpeechToText/useSpeechToText'

import useAvatar from '../../hooks/useAvatar'
import Avatar from '../../hooks/Avatar'
import { Button, Avatar as FUIAvatar } from '@fluentui/react-components'
import { DrawerBody, OverlayDrawer } from '@fluentui/react-components'
const enum messageStatus {
  NotRunning = 'Not Running',
  Processing = 'Processing',
  Done = 'Done'
}

const quickQuestions = [
  'What is our training incentive policy?',
  'I got married, what do I need to do?',
  'I need to take a leave of absence, what should I do?',
  'Who is our medical provider?',
  'What does Guardian cover for me?',
  'What is our PTO Loan Policy?'
]

const userGreeting = 'Hi'

const Chat = () => {
  const appStateContext = useContext(AppStateContext)
  const AUTH_ENABLED = appStateContext?.state.frontendSettings?.auth_enabled
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showLoadingMessage, setShowLoadingMessage] = useState<boolean>(false)
  const [activeCitation, setActiveCitation] = useState<Citation>()
  const [isCitationPanelOpen, setIsCitationPanelOpen] = useState<boolean>(false)
  const [isIntentsPanelOpen, setIsIntentsPanelOpen] = useState<boolean>(false)
  const abortFuncs = useRef([] as AbortController[])
  const [showAuthMessage, setShowAuthMessage] = useState<boolean | undefined>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [execResults, setExecResults] = useState<ExecResults[]>([])
  const [processMessages, setProcessMessages] = useState<messageStatus>(messageStatus.NotRunning)
  const [clearingChat, setClearingChat] = useState<boolean>(false)
  const [hideErrorDialog, { toggle: toggleErrorDialog }] = useBoolean(true)
  const [errorMsg, setErrorMsg] = useState<ErrorMessage | null>()
  const [avatarEnabled, setAvatarEnabled] = useState<boolean>(false)
  const [speechToSpeech, setSpeechToSpeech] = useState<boolean>(false)
  const [question, setQuestion] = useState<string>('')
  const [chatTitle, setChatTitle] = useState<string>('Hi!')
  const [user, setUser] = useState<User | null>(appStateContext!.state.user)

  const { micState, onRecognize, onRecognizing, startSpeechToText, stopSpeechToText } = useSpeechToText()
  const { speak, updateVideoRefs, stopAvatarSpeech, avatar, onEndOfSpeech } = useAvatar()

  const remoteVideoRef = useRef<HTMLDivElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    updateVideoRefs(remoteVideoRef, localVideoRef)
  }, [avatarEnabled])

  const errorDialogContentProps = {
    type: DialogType.close,
    title: errorMsg?.title,
    closeButtonAriaLabel: 'Close',
    subText: errorMsg?.subtitle
  }

  const modalProps = {
    titleAriaId: 'labelId',
    subtitleAriaId: 'subTextId',
    isBlocking: true,
    styles: { main: { maxWidth: 450 } }
  }

  const [ASSISTANT, TOOL, ERROR] = ['assistant', 'tool', 'error']
  const NO_CONTENT_ERROR = 'No content in messages object.'

  useEffect(() => {
    if (
      appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.Working &&
      appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured &&
      appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Fail &&
      hideErrorDialog
    ) {
      let subtitle = `${appStateContext.state.isCosmosDBAvailable.status}. Please contact the site administrator.`
      setErrorMsg({
        title: 'Chat history is not enabled',
        subtitle: subtitle
      })
      toggleErrorDialog()
    }
  }, [appStateContext?.state.isCosmosDBAvailable])

  const handleErrorDialogClose = () => {
    toggleErrorDialog()
    setTimeout(() => {
      setErrorMsg(null)
    }, 500)
  }

  const handleSwitch = () => {
    setAvatarEnabled(!avatarEnabled)
  }

  useEffect(() => {
    setIsLoading(appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Loading)
  }, [appStateContext?.state.chatHistoryLoadingState])

  const getUserInfoList = async () => {
    if (!AUTH_ENABLED) {
      setShowAuthMessage(false)
      return
    }
    const userInfoList = await getUserInfo()
    if (userInfoList.length === 0 && window.location.hostname !== '127.0.0.1') {
      setShowAuthMessage(true)
    } else {
      setShowAuthMessage(false)
    }
  }

  let assistantMessage = {} as ChatMessage
  let toolMessage = {} as ChatMessage
  let assistantContent = ''

  const processResultMessage = (resultMessage: ChatMessage, userMessage: ChatMessage, qta_id: string, conversationId?: string) => {
    if (resultMessage.content.includes('all_exec_results')) {
      const parsedExecResults = JSON.parse(resultMessage.content) as AzureSqlServerExecResults
      setExecResults(parsedExecResults.all_exec_results)
    }

    if (resultMessage.role === ASSISTANT) {
      assistantContent += resultMessage.content
      assistantMessage = resultMessage
      assistantMessage.content = assistantContent
      assistantMessage.inquiry_id = qta_id

      if (resultMessage.context) {
        toolMessage = {
          id: uuid(),
          role: TOOL,
          content: resultMessage.context,
          date: new Date().toISOString()
        }
      }
    }

    if (resultMessage.role === TOOL) {
      toolMessage = resultMessage
      toolMessage.inquiry_id = qta_id
    }

    if (!conversationId) {
      isEmpty(toolMessage)
        ? setMessages([...messages, userMessage, assistantMessage])
        : setMessages([...messages, userMessage, toolMessage, assistantMessage])
    } else {
      isEmpty(toolMessage)
        ? setMessages([...messages, assistantMessage])
        : setMessages([...messages, toolMessage, assistantMessage])
    }
  }

  // const makeApiRequestWithoutCosmosDB = async (question: string, conversationId?: string) => {
  //   setIsLoading(true)
  //   setShowLoadingMessage(true)
  //   const abortController = new AbortController()
  //   abortFuncs.current.unshift(abortController)

  //   const userMessage: ChatMessage = {
  //     id: uuid(),
  //     role: 'user',
  //     content: question,
  //     date: new Date().toISOString()
  //   }

  //   let conversation: Conversation | null | undefined
  //   if (!conversationId) {
  //     conversation = {
  //       id: conversationId ?? uuid(),
  //       title: question,
  //       messages: [userMessage],
  //       date: new Date().toISOString()
  //     }
  //   } else {
  //     conversation = appStateContext?.state?.currentChat
  //     if (!conversation) {
  //       console.error('Conversation not found.')
  //       setIsLoading(false)
  //       setShowLoadingMessage(false)
  //       abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
  //       return
  //     } else {
  //       conversation.messages.push(userMessage)
  //     }
  //   }

  //   appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: conversation })
  //   setMessages(conversation.messages)

  //   const request: ConversationRequest = {
  //     messages: [...conversation.messages.filter(answer => answer.role !== ERROR)]
  //   }

  //   let result = {} as ChatResponse
  //   try {
  //     const response = await conversationApi(request, abortController.signal)
  //     if (response?.body) {
  //       const reader = response.body.getReader()
  //       let runningText = ''
  //       while (true) {
  //         setProcessMessages(messageStatus.Processing)
  //         const { done, value } = await reader.read()
  //         if (done) break

  //         var text = new TextDecoder('utf-8').decode(value)
  //         const objects = text.split('\n')
  //         objects.forEach(obj => {
  //           try {
  //             if (obj !== '' && obj !== '{}') {
  //               runningText += obj
  //               result = JSON.parse(runningText)
  //               if (result.choices?.length > 0) {
  //                 result.choices[0].messages.forEach(msg => {
  //                   msg.id = result.id
  //                   msg.date = new Date().toISOString()
  //                 })
  //                 if (result.choices[0].messages?.some(m => m.role === ASSISTANT)) {
  //                   setShowLoadingMessage(false)
  //                 }
  //                 result.choices[0].messages.forEach(resultObj => {
  //                   processResultMessage(resultObj, userMessage, conversationId)
  //                 })
  //               } else if (result.error) {
  //                 throw Error(result.error)
  //               }
  //               runningText = ''
  //             }
  //           } catch (e) {
  //             if (!(e instanceof SyntaxError)) {
  //               console.error(e)
  //               throw e
  //             } else {
  //               console.log('Incomplete message. Continuing...')
  //             }
  //           }
  //         })
  //       }
  //       conversation.messages.push(toolMessage, assistantMessage)
  //       appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: conversation })
  //       setMessages([...messages, toolMessage, assistantMessage])
  //     }
  //   } catch (e) {
  //     if (!abortController.signal.aborted) {
  //       let errorMessage =
  //         'An error occurred. Please try again. If the problem persists, please contact the site administrator.'
  //       if (result.error?.message) {
  //         errorMessage = result.error.message
  //       } else if (typeof result.error === 'string') {
  //         errorMessage = result.error
  //       }

  //       errorMessage = parseErrorMessage(errorMessage)

  //       let errorChatMsg: ChatMessage = {
  //         id: uuid(),
  //         role: ERROR,
  //         content: errorMessage,
  //         date: new Date().toISOString()
  //       }
  //       conversation.messages.push(errorChatMsg)
  //       appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: conversation })
  //       setMessages([...messages, errorChatMsg])
  //     } else {
  //       setMessages([...messages, userMessage])
  //     }
  //   } finally {
  //     setIsLoading(false)
  //     setShowLoadingMessage(false)
  //     abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
  //     setProcessMessages(messageStatus.Done)
  //   }

  //   return abortController.abort()
  // }

  const makeApiRequestWithCosmosDB = async (question: string, conversationId?: string) => {
    setIsLoading(true)
    setShowLoadingMessage(true)
    const abortController = new AbortController()
    abortFuncs.current.unshift(abortController)

    const qta_id = uuid()

    const userMessage: ChatMessage = {
      id: uuid(),
      role: 'user',
      inquiry_id: qta_id,
      content: question,
      date: new Date().toISOString()
    }

    if (user && user.fullname.toLowerCase() != 'dummy' && user.email.toLowerCase() != 'dummy') {
      userMessage.user_name = user.fullname
      userMessage.user_email = user.email
    }

    //api call params set here (generate)
    let request: ConversationRequest
    let conversation
    if (conversationId) {
      conversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
      if (!conversation) {
        console.error('Conversation not found.')
        setIsLoading(false)
        setShowLoadingMessage(false)
        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
        return
      } else {
        conversation.messages.push(userMessage)
        request = {
          messages: [...conversation.messages.filter(answer => answer.role !== ERROR)]
        }
      }
    } else {
      request = {
        messages: [userMessage].filter(answer => answer.role !== ERROR)
      }
      setMessages(request.messages)
    }
    let result = {} as ChatResponse
    var errorResponseMessage = 'Please try again. If the problem persists, please contact the site administrator.'
    try {
      const response = conversationId
        ? await historyGenerate(request, abortController.signal, conversationId)
        : await historyGenerate(request, abortController.signal)
      if (!response?.ok) {
        const responseJson = await response.json()
        errorResponseMessage =
          responseJson.error === undefined ? errorResponseMessage : parseErrorMessage(responseJson.error)
        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: ERROR,
          content: `There was an error generating a response. Chat history can't be saved at this time. ${errorResponseMessage}`,
          date: new Date().toISOString()
        }
        let resultConversation
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
          if (!resultConversation) {
            console.error('Conversation not found.')
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            return
          }
          resultConversation.messages.push(errorChatMsg)
        } else {
          setMessages([...messages, userMessage, errorChatMsg])
          setIsLoading(false)
          setShowLoadingMessage(false)
          abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
          return
        }
        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: resultConversation })
        setMessages([...resultConversation.messages])
        return
      }
      if (response?.body) {
        const reader = response.body.getReader()

        let runningText = ''
        while (true) {
          setProcessMessages(messageStatus.Processing)
          const { done, value } = await reader.read()
          if (done) break

          var text = new TextDecoder('utf-8').decode(value)
          const objects = text.split('\n')
          objects.forEach(obj => {
            try {
              if (obj !== '' && obj !== '{}') {
                runningText += obj
                result = JSON.parse(runningText)
                if (!result.choices?.[0]?.messages?.[0].content) {
                  errorResponseMessage = NO_CONTENT_ERROR
                  throw Error()
                }
                if (result.choices?.length > 0) {
                  result.choices[0].messages.forEach(msg => {
                    msg.id = result.id
                    msg.date = new Date().toISOString()
                  })
                  if (result.choices[0].messages?.some(m => m.role === ASSISTANT)) {
                    setShowLoadingMessage(false)
                  }
                  result.choices[0].messages.forEach(resultObj => {
                    processResultMessage(resultObj, userMessage, qta_id, conversationId)
                  })
                }
                runningText = ''
              } else if (result.error) {
                throw Error(result.error)
              }
            } catch (e) {
              if (!(e instanceof SyntaxError)) {
                console.error(e)
                throw e
              } else {
                console.log('Incomplete message. Continuing...')
              }
            }
          })
        }

        // if (avatarEnabled) {
        //   const endOfSpeech = async () => {
        //     if (abortController.signal.aborted) {
        //       if (speechToSpeech) await startSpeechToText()
        //     }
        //   }
        //   onEndOfSpeech(endOfSpeech)
        //   await speak(formatedResult)
        // }

        // await streamMessage(messageStream)

        let resultConversation
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
          if (!resultConversation) {
            console.error('Conversation not found.')
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            return
          }
          isEmpty(toolMessage)
            ? resultConversation.messages.push(assistantMessage)
            : resultConversation.messages.push(toolMessage, assistantMessage)
        } else {
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date
          }
          isEmpty(toolMessage)
            ? resultConversation.messages.push(assistantMessage)
            : resultConversation.messages.push(toolMessage, assistantMessage)
        }
        if (!resultConversation) {
          setIsLoading(false)
          setShowLoadingMessage(false)
          abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
          return
        }
        if (avatarEnabled) {
          await speak(resultConversation.messages[resultConversation.messages.length - 1].content)
        }
        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: resultConversation })
        isEmpty(toolMessage)
          ? setMessages([...messages, assistantMessage])
          : setMessages([...messages, toolMessage, assistantMessage])
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        let errorMessage = `An error occurred. ${errorResponseMessage}`
        if (result.error?.message) {
          errorMessage = result.error.message
        } else if (typeof result.error === 'string') {
          errorMessage = result.error
        }

        errorMessage = parseErrorMessage(errorMessage)

        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: ERROR,
          content: errorMessage,
          date: new Date().toISOString()
        }
        let resultConversation
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
          if (!resultConversation) {
            console.error('Conversation not found.')
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            return
          }
          resultConversation.messages.push(errorChatMsg)
        } else {
          if (!result.history_metadata) {
            console.error('Error retrieving data.', result)
            let errorChatMsg: ChatMessage = {
              id: uuid(),
              role: ERROR,
              content: errorMessage,
              date: new Date().toISOString()
            }
            setMessages([...messages, userMessage, errorChatMsg])
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            return
          }
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date
          }
          resultConversation.messages.push(errorChatMsg)
        }
        if (!resultConversation) {
          setIsLoading(false)
          setShowLoadingMessage(false)
          abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
          return
        }
        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: resultConversation })
        setMessages([...messages, errorChatMsg])
      } else {
        setMessages([...messages, userMessage])
      }
    } finally {
      setIsLoading(false)
      setShowLoadingMessage(false)
      abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
      setProcessMessages(messageStatus.Done)
    }

    return abortController.abort()
  }

  const clearChat = async () => {
    setClearingChat(true)
    if (appStateContext?.state.currentChat?.id && appStateContext?.state.isCosmosDBAvailable.cosmosDB) {
      let response = await historyClear(appStateContext?.state.currentChat.id)
      if (!response.ok) {
        setErrorMsg({
          title: 'Error clearing current chat',
          subtitle: 'Please try again. If the problem persists, please contact the site administrator.'
        })
        toggleErrorDialog()
      } else {
        appStateContext?.dispatch({
          type: 'DELETE_CURRENT_CHAT_MESSAGES',
          payload: appStateContext?.state.currentChat.id
        })
        appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY', payload: appStateContext?.state.currentChat })
        setActiveCitation(undefined)
        setIsCitationPanelOpen(false)
        setIsIntentsPanelOpen(false)
        setMessages([])
      }
    }
    setClearingChat(false)
  }

  const tryGetRaiPrettyError = (errorMessage: string) => {
    try {
      // Using a regex to extract the JSON part that contains "innererror"
      const match = errorMessage.match(/'innererror': ({.*})\}\}/)
      if (match) {
        // Replacing single quotes with double quotes and converting Python-like booleans to JSON booleans
        const fixedJson = match[1]
          .replace(/'/g, '"')
          .replace(/\bTrue\b/g, 'true')
          .replace(/\bFalse\b/g, 'false')
        const innerErrorJson = JSON.parse(fixedJson)
        let reason = ''
        // Check if jailbreak content filter is the reason of the error
        const jailbreak = innerErrorJson.content_filter_result.jailbreak
        if (jailbreak.filtered === true) {
          reason = 'Jailbreak'
        }

        // Returning the prettified error message
        if (reason !== '') {
          return (
            'The prompt was filtered due to triggering Azure OpenAI’s content filtering system.\n' +
            'Reason: This prompt contains content flagged as ' +
            reason +
            '\n\n' +
            'Please modify your prompt and retry. Learn more: https://go.microsoft.com/fwlink/?linkid=2198766'
          )
        }
      }
    } catch (e) {
      console.error('Failed to parse the error:', e)
    }
    return errorMessage
  }

  const parseErrorMessage = (errorMessage: string) => {
    let errorCodeMessage = errorMessage.substring(0, errorMessage.indexOf('-') + 1)
    const innerErrorCue = "{\\'error\\': {\\'message\\': "
    if (errorMessage.includes(innerErrorCue)) {
      try {
        let innerErrorString = errorMessage.substring(errorMessage.indexOf(innerErrorCue))
        if (innerErrorString.endsWith("'}}")) {
          innerErrorString = innerErrorString.substring(0, innerErrorString.length - 3)
        }
        innerErrorString = innerErrorString.replaceAll("\\'", "'")
        let newErrorMessage = errorCodeMessage + ' ' + innerErrorString
        errorMessage = newErrorMessage
      } catch (e) {
        console.error('Error parsing inner error message: ', e)
      }
    }

    return tryGetRaiPrettyError(errorMessage)
  }

  const newChat = () => {
    setProcessMessages(messageStatus.Processing)
    setMessages([])
    setIsCitationPanelOpen(false)
    setIsIntentsPanelOpen(false)
    setActiveCitation(undefined)
    appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: null })
    setProcessMessages(messageStatus.Done)
  }

  const stopGenerating = () => {
    if (speechToSpeech) stopSpeechToText()
    abortFuncs.current.forEach(a => a.abort())
    setShowLoadingMessage(false)
    setIsLoading(false)
  }

  useEffect(() => {
    if (appStateContext?.state.currentChat) {
      setMessages(appStateContext.state.currentChat.messages)
    } else {
      setMessages([])
    }
  }, [appStateContext?.state.currentChat])

  useLayoutEffect(() => {
    const saveToDB = async (messages: ChatMessage[], id: string) => {
      const response = await historyUpdate(messages, id)
      return response
    }

    if (appStateContext && appStateContext.state.currentChat && processMessages === messageStatus.Done) {
      if (appStateContext.state.isCosmosDBAvailable.cosmosDB) {
        if (!appStateContext?.state.currentChat?.messages) {
          console.error('Failure fetching current chat state.')
          return
        }
        const noContentError = appStateContext.state.currentChat.messages.find(m => m.role === ERROR)

        if (!noContentError?.content.includes(NO_CONTENT_ERROR)) {
          saveToDB(appStateContext.state.currentChat.messages, appStateContext.state.currentChat.id)
            .then(res => {
              if (!res.ok) {
                let errorMessage =
                  "An error occurred. Answers can't be saved at this time. If the problem persists, please contact the site administrator."
                let errorChatMsg: ChatMessage = {
                  id: uuid(),
                  role: ERROR,
                  content: errorMessage,
                  date: new Date().toISOString()
                }
                if (!appStateContext?.state.currentChat?.messages) {
                  let err: Error = {
                    ...new Error(),
                    message: 'Failure fetching current chat state.'
                  }
                  throw err
                }
                setMessages([...appStateContext?.state.currentChat?.messages, errorChatMsg])
              }
              return res as Response
            })
            .catch(err => {
              console.error('Error: ', err)
              let errRes: Response = {
                ...new Response(),
                ok: false,
                status: 500
              }
              return errRes
            })
        }
      } else {
      }
      appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY', payload: appStateContext.state.currentChat })
      setMessages(appStateContext.state.currentChat.messages)
      setProcessMessages(messageStatus.NotRunning)
    }
  }, [processMessages])

  useEffect(() => {
    setUser(appStateContext!.state.user)

    appStateContext!.state.user?.firstname
      ? setChatTitle(userGreeting + ', ' + appStateContext!.state.user?.firstname + '!') // Hi, First_Name!
      : setChatTitle(userGreeting + '!')

  }, [appStateContext?.state.user])


  useEffect(() => {
    if (AUTH_ENABLED !== undefined) getUserInfoList()
  }, [AUTH_ENABLED])

  useLayoutEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [showLoadingMessage, processMessages])

  const onShowCitation = (citation: Citation) => {
    setActiveCitation(citation)
    setIsCitationPanelOpen(true)
  }

  const onShowExecResult = () => {
    setIsIntentsPanelOpen(true)
  }

  const onViewSource = (citation: Citation) => {
    if (citation.url && !citation.url.includes('blob.core')) {
      window.open(citation.url, '_blank')
    }
  }

  const parseCitationFromMessage = (message: ChatMessage) => {
    if (message?.role && message?.role === 'tool') {
      try {
        const toolMessage = JSON.parse(message.content) as ToolMessageContent
        return toolMessage.citations
      } catch {
        return []
      }
    }
    return []
  }

  const disabledButton = () => {
    return (
      isLoading ||
      (messages && messages.length === 0) ||
      clearingChat ||
      appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Loading
    )
  }

  const sendQuestion = (sttQuestion?: string) => {
    if (sttQuestion) {
      // appStateContext?.state.isCosmosDBAvailable?.cosmosDB
      makeApiRequestWithCosmosDB(sttQuestion, appStateContext?.state.currentChat?.id)
        // : makeApiRequestWithoutCosmosDB(sttQuestion, appStateContext?.state.currentChat?.id)
    } else {
      // appStateContext?.state.isCosmosDBAvailable?.cosmosDB
      makeApiRequestWithCosmosDB(question, appStateContext?.state.currentChat?.id)
        // : makeApiRequestWithoutCosmosDB(question, appStateContext?.state.currentChat?.id)
    }

    setQuestion('')
  }

  onRecognize(sendQuestion)
  onRecognizing(setQuestion)

  return (
    <div className={styles.container} role="main">
      {showAuthMessage ? (
        <Stack className={styles.chatEmptyState}>
          <ShieldLockRegular
            className={styles.chatIcon}
            style={{ color: 'darkorange', height: '200px', width: '200px' }}
          />
          <h1 className={styles.chatEmptyStateTitle}>Authentication Not Configured</h1>
          <h2 className={styles.chatEmptyStateSubtitle}>
            This app does not have authentication configured. Please add an identity provider by finding your app in the{' '}
            <a href="https://portal.azure.com/" target="_blank">
              Azure Portal
            </a>
            and following{' '}
            <a
              href="https://learn.microsoft.com/en-us/azure/app-service/scenario-secure-app-authentication-app-service#3-configure-authentication-and-authorization"
              target="_blank">
              these instructions
            </a>
            .
          </h2>
          <h2 className={styles.chatEmptyStateSubtitle} style={{ fontSize: '20px' }}>
            <strong>Authentication configuration takes a few minutes to apply. </strong>
          </h2>
          <h2 className={styles.chatEmptyStateSubtitle} style={{ fontSize: '20px' }}>
            <strong>If you deployed in the last 10 minutes, please wait and reload the page after 10 minutes.</strong>
          </h2>
        </Stack>
      ) : (
        <Stack horizontal className={avatarEnabled ? styles.chatRootAvatar : styles.chatRoot}>
          {avatarEnabled && <Avatar avatar={avatar} localVideoRef={localVideoRef} remoteVideoRef={remoteVideoRef} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className={styles.chatContainer}>
              {!messages || messages.length < 1 ? (
                <Stack className={styles.chatEmptyState}>
                  <img src={FITS} className={styles.chatIcon} aria-hidden="true" />
                  <h1 className={styles.chatEmptyStateTitle}>What can I help you with?</h1>
                  <h2 className={styles.chatEmptyStateSubtitle}>
                    Designed to provide guidance and assistance for your human resources processes
                  </h2>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gridAutoRows: '1fr',
                      gap: '1rem'
                    }}>
                    {quickQuestions.map(question => (
                      <QuickQuestion onClick={sendQuestion} question={question} />
                    ))}
                  </div>
                </Stack>
              ) : (
                <div
                  className={styles.chatMessageStream}
                  style={{ marginBottom: isLoading ? '40px' : '0px' }}
                  role="log">
                  {messages.map((answer, index) => (
                    <>
                      {answer.role === 'user' ? (
                        <div className={styles.chatMessageUser} tabIndex={0}>
                          <div className={styles.chatMessageUserMessage}>{answer.content}</div>
                          <FUIAvatar />
                        </div>
                      ) : answer.role === 'assistant' ? (
                        <div className={styles.chatMessageGpt}>
                          <Answer
                            answer={{
                              answer: answer.content,
                              citations: parseCitationFromMessage(messages[index - 1]),
                              message_id: answer.id,
                              feedback: answer.feedback,
                              exec_results: execResults
                            }}
                            onCitationClicked={c => onShowCitation(c)}
                            onExectResultClicked={() => onShowExecResult()}
                          />
                        </div>
                      ) : answer.role === ERROR ? (
                        <div className={styles.chatMessageError}>
                          <Stack horizontal className={styles.chatMessageErrorContent}>
                            <ErrorCircleRegular
                              className={styles.errorIcon}
                              style={{ color: 'rgba(182, 52, 67, 1)' }}
                            />
                            <span>Error</span>
                          </Stack>
                          <span className={styles.chatMessageErrorContent}>{answer.content}</span>
                        </div>
                      ) : null}
                    </>
                  ))}
                  {showLoadingMessage && (
                    <>
                      <div className={styles.chatMessageGpt}>
                        <Answer
                          answer={{
                            answer: 'Generating answer...',
                            citations: []
                          }}
                          onCitationClicked={() => null}
                          onExectResultClicked={() => null}
                        />
                      </div>
                    </>
                  )}
                  <div ref={chatMessageStreamEnd} />
                </div>
              )}
            </div>
            <Stack className={styles.chatInput}>
              <Stack horizontal className={styles.stopButtons}>
                {avatar.isSpeaking && (
                  <Button
                    shape="circular"
                    icon={<StopRegular />}
                    onClick={() => {
                      stopAvatarSpeech()
                      setIsLoading(false)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        stopAvatarSpeech()
                        setIsLoading(false)
                      }
                    }}>
                    Stop Avatar's Speech
                  </Button>
                )}
                {isLoading && messages.length > 0 && !avatar.isSpeaking && (
                  <Button
                    shape="circular"
                    icon={<StopRegular />}
                    onClick={stopGenerating}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? stopGenerating() : null)}>
                    Stop Generating
                  </Button>
                )}            
              </Stack>
              <Stack>
                <Dialog
                  hidden={hideErrorDialog}
                  onDismiss={handleErrorDialogClose}
                  dialogContentProps={errorDialogContentProps}
                  modalProps={modalProps}></Dialog>
              </Stack>
              {speechToSpeech && (
                <SpeechToSpeechController
                  onNewChat={newChat}
                  enableSpeechToSpeech={() => setSpeechToSpeech(!speechToSpeech)}
                  chatState={disabledButton()}
                  avatarSpeaking={avatar.isSpeaking || isLoading}
                  micState={micState}
                  startSpeechToSpeech={startSpeechToText}
                  stopSpeechToSpeech={stopSpeechToText}
                />
              )}
              {!speechToSpeech && (
                <QuestionInput
                  micState={micState}
                  setQuestion={setQuestion}
                  question={question}
                  toggleSpeechToSpeech={() => {
                    setSpeechToSpeech(!speechToSpeech)
                    setAvatarEnabled(true)
                  }}
                  clearOnSend
                  handleSwitch={handleSwitch}
                  avatarEnabled={avatarEnabled}
                  disabled={isLoading}
                  onNewChat={newChat}
                  chatState={disabledButton()}
                  onSend={sendQuestion}
                  startSpeechToText={startSpeechToText}
                  onClearChat={
                    appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured
                      ? clearChat
                      : newChat
                  }
                />
              )}
            </Stack>
          </div>
          {/* Citation Panel */}
          {messages && messages.length > 0 && isCitationPanelOpen && activeCitation && (
            <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel" aria-label="Citations Panel">
              <Stack
                aria-label="Citations Panel Header Container"
                horizontal
                className={styles.citationPanelHeaderContainer}
                horizontalAlign="space-between"
                verticalAlign="center">
                <span aria-label="Citations" className={styles.citationPanelHeader}>
                  Citations
                </span>
                <IconButton
                  iconProps={{ iconName: 'Cancel' }}
                  aria-label="Close citations panel"
                  onClick={() => setIsCitationPanelOpen(false)}
                />
              </Stack>
              <h5
                className={styles.citationPanelTitle}
                tabIndex={0}
                title={
                  activeCitation.url && !activeCitation.url.includes('blob.core')
                    ? activeCitation.url
                    : activeCitation.title ?? ''
                }
                onClick={() => onViewSource(activeCitation)}>
                {activeCitation.title}
              </h5>
              <div tabIndex={0}>
                <ReactMarkdown
                  linkTarget="_blank"
                  className={styles.citationPanelContent}
                  children={DOMPurify.sanitize(activeCitation.content, { ALLOWED_TAGS: XSSAllowTags })}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                />
              </div>
            </Stack.Item>
          )}
          {messages && messages.length > 0 && isIntentsPanelOpen && (
            <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel" aria-label="Intents Panel">
              <Stack
                aria-label="Intents Panel Header Container"
                horizontal
                className={styles.citationPanelHeaderContainer}
                horizontalAlign="space-between"
                verticalAlign="center">
                <span aria-label="Intents" className={styles.citationPanelHeader}>
                  Intents
                </span>
                <IconButton
                  iconProps={{ iconName: 'Cancel' }}
                  aria-label="Close intents panel"
                  onClick={() => setIsIntentsPanelOpen(false)}
                />
              </Stack>
              <Stack horizontalAlign="space-between">
                {execResults.map(execResult => {
                  return (
                    <Stack className={styles.exectResultList} verticalAlign="space-between">
                      <>
                        <span>Intent:</span> <p>{execResult.intent}</p>
                      </>
                      {execResult.search_query && (
                        <>
                          <span>Search Query:</span>
                          <SyntaxHighlighter
                            style={nord}
                            wrapLines={true}
                            lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
                            language="sql"
                            PreTag="p">
                            {execResult.search_query}
                          </SyntaxHighlighter>
                        </>
                      )}
                      {execResult.search_result && (
                        <>
                          <span>Search Result:</span> <p>{execResult.search_result}</p>
                        </>
                      )}
                      {execResult.code_generated && (
                        <>
                          <span>Code Generated:</span>
                          <SyntaxHighlighter
                            style={nord}
                            wrapLines={true}
                            lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
                            language="python"
                            PreTag="p">
                            {execResult.code_generated}
                          </SyntaxHighlighter>
                        </>
                      )}
                      <>
                        <span>Intent:</span> <p>{execResult.intent}</p>
                      </>
                      {execResult.search_query && (
                        <>
                          <span>Search Query:</span>
                          <SyntaxHighlighter
                            style={nord}
                            wrapLines={true}
                            lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
                            language="sql"
                            PreTag="p">
                            {execResult.search_query}
                          </SyntaxHighlighter>
                        </>
                      )}
                      {execResult.search_result && (
                        <>
                          <span>Search Result:</span> <p>{execResult.search_result}</p>
                        </>
                      )}
                      {execResult.code_generated && (
                        <>
                          <span>Code Generated:</span>
                          <SyntaxHighlighter
                            style={nord}
                            wrapLines={true}
                            lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
                            language="python"
                            PreTag="p">
                            {execResult.code_generated}
                          </SyntaxHighlighter>
                        </>
                      )}
                    </Stack>
                  )
                })}
              </Stack>
            </Stack.Item>
          )}
        </Stack>
      )}
      {appStateContext?.state.isChatHistoryOpen &&
        appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured && (
          <OverlayDrawer open={true} position="end">
            <DrawerBody>
              <ChatHistoryPanel />
            </DrawerBody>
          </OverlayDrawer>
        )}
    </div>
  )
}

export default Chat

type QuickQuestionProps = {
  question: string
  onClick: Function
}
const QuickQuestion = ({ question, onClick }: QuickQuestionProps) => {
  return (
    <Button onClick={() => onClick(question)} icon={<LightbulbFilamentRegular />} appearance="outline">
      {question}
    </Button>
  )
}
