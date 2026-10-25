/* Starter catalogue, loaded into Redis once on first run (moved here from app.js). */
const CATEGORIES = [
  "Photo Printing & Frames",
  "Laptop Stickers",
  "Phone Cases",
  "Computer Accessories",
  "Graphic Designing",
  "Bulk SMS",
  "Web Development",
  "Custom Printing Services",
  "Others"
];

const PRODUCTS = [
  {id:"p1",name:"A4 Photo Print",category:"Photo Printing & Frames",price:50,stock:40,images:[],video:"",desc:"High quality A4 sized print of your favourite photo, ready to frame or gift."},
  {id:"p2",name:"A3 Photo Print",category:"Photo Printing & Frames",price:90,stock:35,images:[],video:"",desc:"Bigger A3 print for a bolder wall statement."},
  {id:"p3",name:"15 x 19 Print",category:"Photo Printing & Frames",price:130,stock:25,images:[],video:"",desc:"15 x 19 premium photo print."},
  {id:"p4",name:"16 x 20 Print",category:"Photo Printing & Frames",price:160,stock:25,images:[],video:"",desc:"16 x 20 premium photo print."},
  {id:"p5",name:"19 x 23 Print",category:"Photo Printing & Frames",price:190,stock:20,images:[],video:"",desc:"19 x 23 premium photo print."},
  {id:"p6",name:"20 x 24 Print",category:"Photo Printing & Frames",price:220,stock:20,images:[],video:"",desc:"20 x 24 premium photo print."},
  {id:"p7",name:"20 x 30 Print",category:"Photo Printing & Frames",price:280,stock:15,images:[],video:"",desc:"20 x 30 large premium photo print."},
  {id:"p8",name:"23 x 32 Print",category:"Photo Printing & Frames",price:330,stock:12,images:[],video:"",desc:"23 x 32 large premium photo print."},
  {id:"p9",name:"24 x 36 Print",category:"Photo Printing & Frames",price:400,stock:10,images:[],video:"",desc:"24 x 36 extra-large statement print."},
  {id:"p10",name:"Table Top Frame",category:"Photo Printing & Frames",price:80,stock:30,images:[],video:"",desc:"Elegant table top frame for your desk or shelf."},
  {id:"p11",name:"Frameless Frame",category:"Photo Printing & Frames",price:120,stock:20,images:[],video:"",desc:"Modern frameless display for a clean, floating look."},
  {id:"p12",name:"Citation Frame",category:"Photo Printing & Frames",price:150,stock:18,images:[],video:"",desc:"Beautifully finished frame for certificates, awards and citations."},
  {id:"p13",name:"Interior Decor Frame",category:"Photo Printing & Frames",price:180,stock:15,images:[],video:"",desc:"Statement frame for interior decor pieces."},
  {id:"p14",name:"Laptop Sticker — Back Only",category:"Laptop Stickers",price:60,stock:40,images:[],video:"",desc:"Custom sticker skin for the back of your laptop only."},
  {id:"p15",name:"Laptop Sticker — Keyboard & Back",category:"Laptop Stickers",price:90,stock:30,images:[],video:"",desc:"Custom sticker covering the keyboard area and back panel."},
  {id:"p16",name:"Laptop Sticker — Full Body",category:"Laptop Stickers",price:130,stock:25,images:[],video:"",desc:"Full-body custom laptop skin, back, keyboard deck and edges."},
  {id:"p17",name:"Custom Phone Case",category:"Phone Cases",price:70,stock:35,images:[],video:"",desc:"Personalised phone case printed with your chosen photo or design."},
  {id:"p18",name:"Logo & Brand Design",category:"Graphic Designing",price:150,stock:999,images:[],video:"",desc:"Professional logo and brand identity design service."},
  {id:"p19",name:"Flyer / Poster Design",category:"Graphic Designing",price:80,stock:999,images:[],video:"",desc:"Eye-catching flyer or poster design for your business or event."},
  {id:"p20",name:"Bulk SMS — 500 Units",category:"Bulk SMS",price:60,stock:999,images:[],video:"",desc:"Send 500 SMS units to your customers or contacts, fast and reliable."},
  {id:"p21",name:"Bulk SMS — 2000 Units",category:"Bulk SMS",price:200,stock:999,images:[],video:"",desc:"Send 2000 SMS units — great for larger campaigns and announcements."},
  {id:"p22",name:"Business Website (Starter)",category:"Web Development",price:1500,stock:999,images:[],video:"",desc:"A clean, mobile-friendly website to showcase your business online."},
  {id:"p23",name:"E-commerce Website",category:"Web Development",price:3500,stock:999,images:[],video:"",desc:"Full online store with cart, checkout and admin panel — like this one."},
  {id:"p24",name:"Custom T-Shirt Printing",category:"Custom Printing Services",price:45,stock:999,images:[],video:"",desc:"Print your design or photo on a quality T-shirt."},
  {id:"p25",name:"Custom Mug Printing",category:"Custom Printing Services",price:35,stock:999,images:[],video:"",desc:"Personalised mug printing — great for gifts."}
];

module.exports = { CATEGORIES, PRODUCTS };
