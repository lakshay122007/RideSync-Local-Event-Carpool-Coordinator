import {
  Loader2, Inbox, Star, AlertTriangle, GraduationCap, Dumbbell, ShoppingBag, BookOpen, Music, Sparkles,
} from 'lucide-react';

const categoryIcons = {
  college_fest: GraduationCap,
  gym: Dumbbell,
  market: ShoppingBag,
  exam: BookOpen,
  concert: Music,
  custom: Sparkles,
};

export function CategoryIcon({ category, size = 22 }) {
  const Icon = categoryIcons[category] || Sparkles;
  return <Icon size={size} />;
}

export function Loading({ text = 'Loading' }) {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={22} /> {text}
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="empty card">
      <Icon />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p className="error" role="alert">
      <AlertTriangle size={18} /> {children}
    </p>
  );
}

export function StatusTag({ status }) {
  return <span className={`tag status-${status}`}>{status}</span>;
}

export function Stars({ value }) {
  if (!value) return <span className="muted">No ratings yet</span>;
  return (
    <span className="stars">
      <Star /> {value}
    </span>
  );
}

export function Avatar({ name, big }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  return <span className={big ? 'avatar big' : 'avatar'} aria-hidden="true">{letter}</span>;
}

export function ConfirmDialog({ open, title, text, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title">{title}</h3>
        <p className="muted">{text}</p>
        <div className="row">
          <button className="secondary" onClick={onCancel}>Keep it</button>
          <button className="danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
