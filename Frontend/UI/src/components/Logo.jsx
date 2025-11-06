import React from 'react'
import { Link } from 'react-router-dom'

const Logo = () => {
    return (
        <div className="group inline-block">
            <Link to="/">
                <i className="ri-hourglass-line text-[#18d4d1] text-6xl 
                          inline-block
                          transition-transform duration-500 ease-in-out
                          group-hover:rotate-180 ">

                </i>
            </Link>

        </div>
    )
}

export default Logo