import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { initializeIcons } from '@fluentui/react'

import Chat from './pages/chat/Chat'
import Layout from './pages/layout/Layout'
import NoPage from './pages/NoPage'
import { AppStateProvider } from './state/AppProvider'

import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication } from '@azure/msal-browser'

import { FluentProvider, webLightTheme } from '@fluentui/react-components'

import './index.css'

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID
const AUTHORITY_URL = import.meta.env.VITE_AUTHORITY_URL
const TENANT_ID = import.meta.env.VITE_TENANT_ID

initializeIcons()

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`
  }
}

export const msalInstance = new PublicClientApplication(msalConfig)

msalInstance.initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <FluentProvider theme={webLightTheme}>
        <AppStateProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Chat />} />
                <Route path="*" element={<NoPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </AppStateProvider>
      </FluentProvider>
    </MsalProvider>
  )
}
