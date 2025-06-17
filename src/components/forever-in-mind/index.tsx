import { forever } from './data'
import './forever.scss'
const Forever = () => {
  return (
    <main className="forever-section">
        <div className="forever-container">
           <h1 className='forever-title'>Forever in our Hearts</h1>
           <img src="/images/Vector.svg" alt="" />
        </div>

        <div className='forever-wrapper'>
          {
            forever.map((item)=>(
              <div>
                <img src={item.img} alt="" className='forever-image' />
                <h3 className='title'>{item.name}</h3>
              
              </div>
            ))
          }
        </div>
    </main>
  )
}

export default Forever