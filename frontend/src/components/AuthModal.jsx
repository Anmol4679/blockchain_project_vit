import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  UserPlus, 
  LogIn, 
  KeyRound,
  ShieldCheck
} from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialView = 'signIn' }) {
  const [view, setView] = useState(initialView); // 'signIn' | 'signUp' | 'forgotPassword'
  const [signUpStep, setSignUpStep] = useState(1); // 1: email, 2: otp, 3: password
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: otp, 3: new password

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'error' | 'success' | 'info'
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      resetFlows();
    }
  }, [isOpen, initialView]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const resetFlows = () => {
    setSignUpStep(1);
    setForgotStep(1);
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setMessage({ text: '', type: '' });
  };

  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  // 1. SIGN IN
  const handleSignIn = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!isValidEmail(email)) {
      setMessage({ text: 'Please enter a valid email address.', type: 'error' });
      return;
    }
    if (!password) {
      setMessage({ text: 'Password is required.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      setMessage({ text: '✓ Signed in successfully.', type: 'success' });
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      }, 600);
    } catch (err) {
      setMessage({ text: err.message || 'Invalid email or password.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // 2. SIGN UP (Step 1: Email OTP)
  const handleSignUpEmail = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!isValidEmail(email)) {
      setMessage({ text: 'Please enter a valid email address.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });

      if (error) throw error;

      setSignUpStep(2);
      setResendCooldown(60);
      setMessage({ text: `Verification code sent to ${email}`, type: 'info' });
    } catch (err) {
      setMessage({ text: err.message || 'Failed to send verification code.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Signup OTP
  const handleVerifySignUpOtp = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!otp || otp.trim().length !== 6) {
      setMessage({ text: 'Please enter the 6-digit code sent to your email.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });

      if (error) throw error;

      setSignUpStep(3);
      setMessage({ text: 'Email verified. Please set your account password.', type: 'info' });
    } catch (err) {
      setMessage({ text: err.message || 'Invalid or expired verification code.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set Initial Password
  const handleSetInitialPassword = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: password });
      if (error) throw error;

      setMessage({ text: '✓ Account created successfully.', type: 'success' });
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      }, 700);
    } catch (err) {
      setMessage({ text: err.message || 'Failed to set password.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // 3. FORGOT PASSWORD (Step 1: Send Reset OTP)
  const handleForgotEmail = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!isValidEmail(email)) {
      setMessage({ text: 'Please enter a valid email address.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });

      if (error) {
        const msg = error.message || '';
        if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no user')) {
          setMessage({ text: 'No account registered with that email.', type: 'error' });
        } else {
          throw error;
        }
        return;
      }

      setForgotStep(2);
      setResendCooldown(60);
      setMessage({ text: `Reset code sent to ${email}`, type: 'info' });
    } catch (err) {
      setMessage({ text: err.message || 'Failed to send reset code.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Forgot OTP
  const handleVerifyForgotOtp = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!otp || otp.trim().length !== 6) {
      setMessage({ text: 'Please enter the 6-digit reset code.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });
      if (error) throw error;

      setForgotStep(3);
      setMessage({ text: 'Code verified. Enter your new password.', type: 'info' });
    } catch (err) {
      setMessage({ text: err.message || 'Invalid or expired code.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Save New Password
  const handleSaveNewPassword = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: password });
      if (error) throw error;

      setMessage({ text: '✓ Password reset successful. Please sign in.', type: 'success' });
      await supabase.auth.signOut();
      setTimeout(() => {
        setView('signIn');
        resetFlows();
      }, 1000);
    } catch (err) {
      setMessage({ text: err.message || 'Failed to update password.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-xl p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="mb-5">
          <h3 className="text-base font-semibold text-slate-900">
            {view === 'signIn' && 'Sign In to BlockDrive'}
            {view === 'signUp' && 'Create Account'}
            {view === 'forgotPassword' && 'Reset Password'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {view === 'signIn' && 'Authenticate to manage your documents and keys'}
            {view === 'signUp' && (
              signUpStep === 1 ? 'Step 1: Enter your email address' :
              signUpStep === 2 ? 'Step 2: Enter 6-digit verification code' :
              'Step 3: Choose account password'
            )}
            {view === 'forgotPassword' && (
              forgotStep === 1 ? 'Step 1: Enter your registered email' :
              forgotStep === 2 ? 'Step 2: Enter 6-digit reset code' :
              'Step 3: Enter your new password'
            )}
          </p>
        </div>

        {/* Message Banner */}
        {message.text && (
          <div className={`mb-4 p-2.5 rounded text-xs flex items-center gap-2 border ${
            message.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-slate-100 border-slate-200 text-slate-800'
          }`}>
            {message.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {message.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {message.type === 'info' && <ShieldCheck className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* SIGN IN */}
        {view === 'signIn' && (
          <form onSubmit={handleSignIn} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-500 rounded text-xs text-slate-900 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3 py-2 pr-9 bg-white border border-slate-300 focus:border-slate-500 rounded text-xs text-slate-900 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setView('forgotPassword');
                  resetFlows();
                }}
                className="text-slate-600 hover:text-slate-900 underline"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="text-center text-xs text-slate-500 pt-3 border-t border-slate-100">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setView('signUp');
                  resetFlows();
                }}
                className="text-slate-900 font-semibold hover:underline"
              >
                Register
              </button>
            </div>
          </form>
        )}

        {/* SIGN UP */}
        {view === 'signUp' && (
          <div>
            {signUpStep === 1 && (
              <form onSubmit={handleSignUpEmail} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-500 rounded text-xs text-slate-900 outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {isLoading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </form>
            )}

            {signUpStep === 2 && (
              <form onSubmit={handleVerifySignUpOtp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-500 rounded text-center tracking-widest font-mono text-sm text-slate-900 outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
            )}

            {signUpStep === 3 && (
              <form onSubmit={handleSetInitialPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Set Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-500 rounded text-xs text-slate-900 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-500 rounded text-xs text-slate-900 outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  {isLoading ? 'Completing Registration...' : 'Complete Registration'}
                </button>
              </form>
            )}

            <div className="text-center text-xs text-slate-500 pt-3 border-t border-slate-100 mt-3">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setView('signIn');
                  resetFlows();
                }}
                className="text-slate-900 font-semibold hover:underline"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* FORGOT PASSWORD */}
        {view === 'forgotPassword' && (
          <div>
            {forgotStep === 1 && (
              <form onSubmit={handleForgotEmail} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-500 rounded text-xs text-slate-900 outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {isLoading ? 'Sending Code...' : 'Send Reset Code'}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleVerifyForgotOtp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Enter 6-Digit Reset Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-500 rounded text-center tracking-widest font-mono text-sm text-slate-900 outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
            )}

            {forgotStep === 3 && (
              <form onSubmit={handleSaveNewPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-500 rounded text-xs text-slate-900 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-500 rounded text-xs text-slate-900 outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  {isLoading ? 'Saving...' : 'Save New Password'}
                </button>
              </form>
            )}

            <div className="text-center text-xs text-slate-500 pt-3 border-t border-slate-100 mt-3">
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => {
                  setView('signIn');
                  resetFlows();
                }}
                className="text-slate-900 font-semibold hover:underline"
              >
                Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
