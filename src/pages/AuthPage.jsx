import React, { useState, useEffect } from 'react';
    import { useLocation, useNavigate, Link } from 'react-router-dom';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { motion } from 'framer-motion';
    import { useToast } from '@/components/ui/use-toast';
    import { useAuth } from '@/contexts/AuthContext';
    import { Chrome, Facebook, Github } from 'lucide-react';
    import ForgotPassword from '@/components/ForgotPassword';
    import ResetPassword from '@/components/ResetPassword';

    const AuthPage = () => {
      const location = useLocation();
      const navigate = useNavigate();
      const { toast } = useToast();
      const { user, login, signup, loginWithProvider } = useAuth();

      const queryParams = new URLSearchParams(location.search);
      const initialMode = queryParams.get('mode') || 'login';
      
      const [activeTab, setActiveTab] = useState(initialMode);
      const [showForgot, setShowForgot] = useState(false);

      const [loginEmail, setLoginEmail] = useState('');
      const [loginPassword, setLoginPassword] = useState('');
      const [signupEmail, setSignupEmail] = useState('');
      const [signupPassword, setSignupPassword] = useState('');
      const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
      const [signupFirstName, setSignupFirstName] = useState("");
      const [signupLastName, setSignupLastName] = useState("");
      const [signupPhone, setSignupPhone] = useState("");

      useEffect(() => {
        if (user) {
          console.log('Current user:', user); // Debug: log the user object
          if (user.id === "22e30fce-c81b-40d8-96f2-2d2291301b0d") {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        }
      }, [user, navigate]);

      useEffect(() => {
        setActiveTab(initialMode);
      }, [initialMode]);

      const handleLogin = async (e) => {
        e.preventDefault();
        if (!loginEmail || !loginPassword) {
          toast({ title: 'Error', description: 'Please fill in all fields.', variant: 'destructive' });
          return;
        }
        try {
          await login(loginEmail, loginPassword);
          toast({ title: 'Success', description: 'Logged in successfully!' });
          // Navigation is handled by useEffect above
        } catch (error) {
          toast({ title: 'Login Failed', description: error.message, variant: 'destructive' });
        }
      };

      const handleSignup = async (e) => {
        e.preventDefault();
        if (!signupEmail || !signupPassword || !signupConfirmPassword || !signupFirstName || !signupLastName || !signupPhone) {
          toast({ title: 'Error', description: 'Please fill in all fields.', variant: 'destructive' });
          return;
        }
        if (signupPassword !== signupConfirmPassword) {
          toast({ title: 'Error', description: 'Passwords do not match.', variant: 'destructive' });
          return;
        }
        try {
          await signup(signupEmail, signupPassword, {
            first_name: signupFirstName,
            last_name: signupLastName,
            phone: signupPhone
          });
          toast({ title: 'Success', description: 'Account created! Check your email for a confirmation link.' });
          setActiveTab('login'); 
          navigate('/auth?mode=login');
        } catch (error) {
          toast({ title: 'Signup Failed', description: error.message, variant: 'destructive' });
        }
      };
      
      const handleSocialLogin = async (provider) => {
        try {
          await loginWithProvider(provider);
          // Supabase handles redirection, so no toast or navigation here is strictly needed
          // unless there's an immediate client-side error before redirection.
        } catch (error) {
          toast({ title: `${provider} Login Failed`, description: error.message, variant: 'destructive' });
        }
      };

      const SocialButton = ({ provider, icon, children, providerId }) => (
        <Button variant="outline" className="w-full" onClick={() => handleSocialLogin(providerId)}>
          {icon}
          {children}
        </Button>
      );

      if (activeTab === 'reset-password') {
        return <ResetPassword />;
      }

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="container mx-auto px-2 sm:px-4 lg:px-6 py-12 flex justify-center items-center min-h-[calc(100vh-10rem)]"
        >
          {showForgot ? (
            <ForgotPassword />
          ) : (
            <Tabs value={activeTab} onValueChange={(value) => {
              setActiveTab(value);
              navigate(`/auth?mode=${value}`);
            }} 
            className="w-full max-w-md">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <Card className="bg-card/80 backdrop-blur-sm shadow-xl border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-3xl font-bold gradient-text">Welcome Back!</CardTitle>
                    <CardDescription>Enter your credentials to access your account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="login-email">Email</Label>
                        <Input id="login-email" type="email" placeholder="m@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="bg-background/70" />
                      </div>
                      <div>
                        <Label htmlFor="login-password">Password</Label>
                        <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="bg-background/70" />
                      </div>
                      <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90">Login</Button>
                    </form>
                    <div className="flex justify-end">
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowForgot(true)}>
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <SocialButton provider="Google" icon={<Chrome className="mr-2 h-4 w-4" />} providerId="google">Login with Google</SocialButton>
                      <SocialButton provider="Facebook" icon={<Facebook className="mr-2 h-4 w-4" />} providerId="facebook">Login with Facebook</SocialButton>
                      <SocialButton provider="GitHub" icon={<Github className="mr-2 h-4 w-4" />} providerId="github">Login with GitHub</SocialButton>
                    </div>
                  </CardContent>
                  <CardFooter className="text-center text-sm">
                    <p>Don't have an account? <Link to="/auth?mode=signup" className="font-medium text-primary hover:underline" onClick={() => setActiveTab('signup')}>Sign up</Link></p>
                  </CardFooter>
                </Card>
              </TabsContent>
              <TabsContent value="signup">
                <Card className="bg-card/80 backdrop-blur-sm shadow-xl border-accent/20">
                  <CardHeader>
                    <CardTitle className="text-3xl font-bold gradient-text">Create an Account</CardTitle>
                    <CardDescription>Join Aximake to start your 3D printing journey.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label htmlFor="signup-first-name">First Name</Label>
                          <Input id="signup-first-name" type="text" value={signupFirstName} onChange={e => setSignupFirstName(e.target.value)} required className="bg-background/70" />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor="signup-last-name">Last Name</Label>
                          <Input id="signup-last-name" type="text" value={signupLastName} onChange={e => setSignupLastName(e.target.value)} required className="bg-background/70" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="signup-phone">Phone Number</Label>
                        <Input id="signup-phone" type="tel" value={signupPhone} onChange={e => setSignupPhone(e.target.value)} required className="bg-background/70" />
                      </div>
                      <div>
                        <Label htmlFor="signup-email">Email</Label>
                        <Input id="signup-email" type="email" placeholder="m@example.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required className="bg-background/70" />
                      </div>
                      <div>
                        <Label htmlFor="signup-password">Password</Label>
                        <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required className="bg-background/70" />
                      </div>
                      <div>
                        <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                        <Input id="signup-confirm-password" type="password" value={signupConfirmPassword} onChange={(e) => setSignupConfirmPassword(e.target.value)} required className="bg-background/70" />
                      </div>
                      <Button type="submit" className="w-full bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90">Sign Up</Button>
                    </form>
                     <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or sign up with</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <SocialButton provider="Google" icon={<Chrome className="mr-2 h-4 w-4" />} providerId="google">Sign up with Google</SocialButton>
                      <SocialButton provider="Facebook" icon={<Facebook className="mr-2 h-4 w-4" />} providerId="facebook">Sign up with Facebook</SocialButton>
                      <SocialButton provider="GitHub" icon={<Github className="mr-2 h-4 w-4" />} providerId="github">Sign up with GitHub</SocialButton>
                    </div>
                  </CardContent>
                  <CardFooter className="text-center text-sm">
                    <p>Already have an account? <Link to="/auth?mode=login" className="font-medium text-primary hover:underline" onClick={() => setActiveTab('login')}>Login</Link></p>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </motion.div>
      );
    };

    export default AuthPage;
