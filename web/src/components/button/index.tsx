import './button.scss';

interface ButtonProps {
    blue?: boolean;
    grey?: boolean;
    red?: boolean;
    transparent?: boolean;
    white?: boolean;
    color?: string;
    width: string;
    children: string | JSX.Element;
    type?: 'submit' | 'reset';
    disabled?: boolean;
    feature?: boolean;
    onClick?: () => void;
}


const Button = ({ blue, grey, red, transparent, white, width, color, children, type, disabled, feature, onClick}: ButtonProps) => {
    return (
        <button className={blue ? 'blue' : red ? 'red' : white ? 'white' : grey ? 'grey' : transparent ? 'transparent' : feature ? 'feature' :'btn'}
            style={transparent ? { maxWidth: width, border: `1px solid ${color}`, color: color } : { maxWidth: width }} 
            type={type ? type : 'button'}
            disabled={disabled ? disabled : false}
            onClick={onClick ? onClick : undefined}
        >
            {children}
        </button>
    )
};


export default Button