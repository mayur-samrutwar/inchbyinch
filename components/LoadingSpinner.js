export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  return (
    <div className="flex items-center justify-center space-x-2">
      <div className={`animate-spin rounded-full border-b-2 border-blue-500 ${sizeClasses[size]}`}></div>
      {text && <span className="text-sm text-gray-500">{text}</span>}
    </div>
  );
}

export function LoadingOverlay({ isVisible, text = 'Processing...' }) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <LoadingSpinner size="lg" text={text} />
      </div>
    </div>
  );
} 