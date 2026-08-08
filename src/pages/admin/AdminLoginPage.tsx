import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AdminLoginPage() {
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.error) {
      setError("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
    } else {
      navigate("/admin", { replace: true });
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-slate-100 px-6">
      <h1 className="text-center text-xl font-bold text-slate-800">
        運営管理ログイン
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">
            メールアドレス
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
          />
        </label>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 py-3 text-base font-bold text-white disabled:opacity-50"
        >
          {submitting ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
