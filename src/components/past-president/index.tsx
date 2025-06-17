import "./alumni.scss";
import {past} from './data'
const PastPresident = () => {
  return (
    <main className="alumni-section">
        <div className="alumni-container">
            <h1 className="alumni-title">Meet the Alumni of <span>UPUMI</span></h1>
            
        </div>

        <div className="past-president-section">
            <h2 className="card-title">Past Presidents of UPUMI</h2>
            <hr />
            <div className="past-container">
                {
                 past.map((item)=>(
                    <div>
                        <img src={item.img} alt="" className="past-image" />
                        <h3 className="title-name">{item.name}</h3>
                        <p className="text-year">{item.year}</p>
                    </div>
                 ))
                }
            </div>
        </div>
    </main>
  )
}

export default PastPresident