import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user.user_metadata?.name || user.email}!
            </h1>
            <p className="mt-2 text-gray-600">
              Ready to start coding collaboratively?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Session</CardTitle>
                <CardDescription>
                  Start a new collaborative coding session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">New Session</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Join Session</CardTitle>
                <CardDescription>
                  Join an existing coding session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">Join Session</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Sessions</CardTitle>
                <CardDescription>
                  View your recent coding sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full">View History</Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Quick Start</CardTitle>
                <CardDescription>
                  Get started with Codely in just a few steps
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Create or join a session</p>
                      <p className="text-sm text-gray-600">Start collaborating with others</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Choose your language</p>
                      <p className="text-sm text-gray-600">JavaScript, Python, or C#</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Start coding together</p>
                      <p className="text-sm text-gray-600">Real-time collaboration and code execution</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
