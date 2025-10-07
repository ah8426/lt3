'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error') || 'unknown';
  const message = searchParams.get('message') || 'An unexpected error occurred during authentication.';

  const getErrorTitle = (errorCode: string) => {
    switch (errorCode) {
      case 'access_denied':
        return 'Access Denied';
      case 'exchange_failed':
        return 'Authentication Failed';
      case 'unexpected':
        return 'Unexpected Error';
      default:
        return 'Authentication Error';
    }
  };

  const getErrorDescription = (errorCode: string, errorMessage: string) => {
    switch (errorCode) {
      case 'access_denied':
        return 'You denied access to your account. Please try again and grant the necessary permissions.';
      case 'exchange_failed':
        return errorMessage || 'We were unable to complete the authentication process. Please try again.';
      case 'unexpected':
        return errorMessage || 'An unexpected error occurred. Please try again or contact support if the problem persists.';
      default:
        return errorMessage || 'Something went wrong during authentication. Please try again.';
    }
  };

  const handleRetry = () => {
    router.push('/login');
  };

  const handleContactSupport = () => {
    // Implement your support contact logic
    window.location.href = 'mailto:support@example.com';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {getErrorTitle(error)}
          </CardTitle>
          <CardDescription className="text-center">
            We encountered a problem while signing you in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Code: {error}</AlertTitle>
            <AlertDescription>
              {getErrorDescription(error, message)}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleRetry}
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleContactSupport}
            >
              Contact Support
            </Button>
          </div>

          <div className="pt-4 text-center text-xs text-muted-foreground">
            <p>
              If you continue to experience issues, please{' '}
              <button
                onClick={handleContactSupport}
                className="underline hover:text-primary"
              >
                contact our support team
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
