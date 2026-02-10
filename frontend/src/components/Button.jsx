export default function Button({ children, onClick, type = "button", variant = "primary", className = "" }) {
  const baseStyles = "px-4 py-2 rounded-md font-medium transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    // Using the custom brand-accent from our @theme block
    primary: "bg-brand-accent text-white hover:opacity-90 focus:ring-blue-500",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };

  return (
    <button 
      type={type} 
      onClick={onClick} 
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
