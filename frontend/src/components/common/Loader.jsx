import { favicon } from "../common/icons";

const Loader = () => {
  return (
    <div className="fixed inset-0 flex justify-center items-center w-full h-screen z-50 bg-white/80 dark:bg-gray-600/80 main-loader top-0 left-0">
        <div className="absolute animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-darkbtn"></div>
        <div className='w-20 h-20 flex items-center justify-center'>
            <img src={favicon} alt="hosta.sh Logo" title="hosta.sh Logo" className="w-12" />
        </div>
    </div>
  )
}

export default Loader