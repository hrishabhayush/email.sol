import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import Footer from '@/components/home/footer';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export default function LoginZero() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Use the correct sonner toast API
    toast.success(`Trying to log in with ${values.email}`, {
      description: 'Login attempt',
    });

    // Here you would typically handle authentication
  }

  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center bg-black">
      <div className="animate-in slide-in-from-bottom-4 w-full max-w-md px-6 py-8 duration-500">
        <div className="mb-4 text-center">
          <h1 className="mb-2 text-4xl font-bold text-white">Login with Solmail</h1>
          <p className="text-muted-foreground">
            Enter your Solmail email below to login to your account
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="nizzy@0.email"
                      {...field}
                      className="bg-black text-sm text-white placeholder:text-sm"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-muted-foreground">Password</FormLabel>
                    <Link
                      to="/forgot-password"
                      className="text-muted-foreground text-xs hover:text-white"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...field}
                      className="bg-black text-white"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              Login
            </Button>

            <div className="mt-6 text-center text-sm">
              <p className="text-muted-foreground">
                Don't have an account?{' '}
                <a href="/zero/signup" className="text-white underline hover:text-white/80">
                  Sign up
                </a>
              </p>
            </div>
          </form>
        </Form>
      </div>

      <Footer />
    </div>
  );
}
