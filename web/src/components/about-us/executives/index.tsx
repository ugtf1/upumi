import "./executives.scss";
import {executives} from './data'
const Executives = () => {
  return (
    <main className="executives-section">

        <div className="executive-container">
            <h2 className="headline">UPUMI Executives</h2>
            <div className="line"></div>
            <div className="executive-card">
                {
                 executives.map((item)=>(
                    <div>
                        <img src={item.img} alt="" className="exco-image" />
                        <h3 className="exco-name">{item.name}</h3>
                        <p className="exco-designation">{item.designation}</p>
                    </div>
                 ))
                }
            </div>
        </div>
    </main>
  )
}

export default Executives