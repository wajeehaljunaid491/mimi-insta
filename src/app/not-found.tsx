import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div className="text-8xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent mb-4">
          404
        </div>
        <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
        <p className="text-gray-600 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/" className="btn btn-primary inline-block">
          Go Home
        </Link>
      </div>
    </div>
  )
}
