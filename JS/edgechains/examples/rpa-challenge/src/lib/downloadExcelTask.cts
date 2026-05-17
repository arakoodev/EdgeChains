import axios from "axios";
import XLSX from "xlsx";

async function downloadExcelData({ url }: { url: string }) {
    try {
        let axiosResponse = await axios(url, { responseType: "arraybuffer" });
        const workbook = XLSX.read(axiosResponse.data);

        let worksheets = workbook.SheetNames.map((sheetName: any) => {
            return { sheetName, data: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) };
        });
        return JSON.stringify(worksheets[0].data);
    } catch (error) {
        console.log(error);
    }
}

module.exports = downloadExcelData;
