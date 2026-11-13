const simplify = require("opencc-js").Converter({ from: "tw", to: "cn" });
export function normalizeLiteraryName(raw: string) {
 const name = raw.trim().normalize("NFKC");
 if (!/^\p{Script=Han}{2,4}$/u.test(name)) throw new Error("雅号需为二至四个汉字");
 const key: string = simplify(name).normalize("NFKC");
 if (["管理员","管理員","站长","站長","慢递局","慢遞局","系统","系統","官方","未题书友","未題書友"].includes(key)) throw new Error("此雅号为站内保留名称");
 return {name,key};
}
