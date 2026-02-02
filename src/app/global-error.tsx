'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            padding: '2rem',
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💥</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Critical Error
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Something went seriously wrong. Please try refreshing the page.
            </p>
            <button
              onClick={reset}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '0.75rem 2rem',
                borderRadius: '0.75rem',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
