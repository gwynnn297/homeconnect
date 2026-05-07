import React from 'react'
import AuthRouter from './routers/AuthRouter.jsx'
import { SocketProvider } from './contexts/SocketContext.jsx'

function App() {
	return (
		<SocketProvider>
			<AuthRouter />
		</SocketProvider>
	)
}

export default App
