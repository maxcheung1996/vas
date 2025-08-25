import './globals.css'
import { Inter } from 'next/font/google'
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'VAS - Video Analytics System',
  description: 'Real-time video analytics with safety detection',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body className={inter.className}>
        <MantineProvider defaultColorScheme="dark">
          <Notifications />
          {children}
        </MantineProvider>
      </body>
    </html>
  )
}
