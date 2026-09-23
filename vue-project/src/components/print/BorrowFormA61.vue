<script setup>
import { computed } from 'vue';

const props = defineProps({
    data: {
        type: Object,
        required: true,
    },
});

const rows = computed(() => {
    const assetList = Array.isArray(props.data.assets)
        ? props.data.assets
        : [];

    const minimumRows = 3;

    return Array.from(
        { length: Math.max(minimumRows, assetList.length) },
        (_, index) => assetList[index] || null,
    );
});
</script>

<template>
    <article id="borrow-print-document"
        class="print-a4-page print-document mx-auto min-h-[297mm] w-[210mm] bg-white px-[12mm] py-[10mm] font-sans text-[16px] leading-[1.25] text-black print:m-0 print:min-h-[297mm] print:w-[210mm] print:px-[12mm] print:py-[10mm]">
        <header class="mb-[4mm]">
            <div class="mb-[2mm] flex items-start gap-[4mm]">
                <div class="grid h-[18mm] w-[18mm] shrink-0 place-items-center border border-black text-[9px]">
                    LOGO
                </div>

                <div class="min-w-0 flex-1">
                    <h1 class="m-0 text-center text-[22px] font-bold leading-[1.15]">
                        บันทึกข้อความ
                    </h1>

                    <div class="mt-[2mm] text-[14px] leading-[1.55]">
                        <div class="flex items-baseline gap-[2mm]">
                            <span class="whitespace-nowrap font-bold">ส่วนราชการ</span>
                            <span class="min-w-0 flex-1 border-b border-dotted border-black px-[1mm] pb-[0.5mm]">
                                กลุ่มงานดิจิทัลการแพทย์ โรงพยาบาลประสาทเชียงใหม่
                            </span>
                        </div>

                        <div class="mt-[1mm] grid grid-cols-2 gap-x-[8mm]">
                            <div class="flex items-baseline gap-[2mm]">
                                <span class="font-bold">ที่</span>
                                <span class="min-w-0 flex-1 border-b border-dotted border-black">
                                    &nbsp;
                                </span>
                            </div>

                            <div class="flex items-baseline gap-[2mm]">
                                <span class="font-bold">วันที่</span>
                                <span class="min-w-0 flex-1 border-b border-dotted border-black">
                                    &nbsp;
                                </span>
                            </div>
                        </div>

                        <div class="mt-[1mm] flex items-baseline gap-[2mm]">
                            <span class="font-bold">เรื่อง</span>
                            <span class="min-w-0 flex-1 border-b border-dotted border-black px-[1mm] pb-[0.5mm]">
                                ขออนุญาตยืมครุภัณฑ์คอมพิวเตอร์ออกนอกพื้นที่โรงพยาบาลประสาทเชียงใหม่
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <section class="text-[16px]">
            <p class="mb-[3mm]">เรียน ผู้อำนวยการโรงพยาบาลประสาทเชียงใหม่</p>

            <p class="mb-[3mm] indent-[12mm] leading-[1.55]">
                ด้วยข้าพเจ้า
                <span class="inline-block min-w-[54mm] border-b border-dotted border-black px-[1mm]">
                    {{ data.borrowerName || '-' }}
                </span>
                ตำแหน่ง
                <span class="inline-block min-w-[34mm] border-b border-dotted border-black px-[1mm]">
                    {{ data.position || '-' }}
                </span>
                หน่วยงาน
                <span class="inline-block min-w-[43mm] border-b border-dotted border-black px-[1mm]">
                    {{ data.department || '-' }}
                </span>
                มีความประสงค์จะขอยืมพัสดุ/ครุภัณฑ์คอมพิวเตอร์
                <span class="font-bold">ออกนอกพื้นที่</span>
                โรงพยาบาลประสาทเชียงใหม่ ตามวัตถุประสงค์และเพื่อประโยชน์ของทางราชการ
                สำหรับงาน
            </p>

            <div class="mb-[3mm] flex flex-wrap justify-center gap-x-[7mm] gap-y-[2mm]">
                <label class="inline-flex items-center gap-[1.5mm] whitespace-nowrap">
                    <span class="h-[4mm] w-[4mm] border border-black" />
                    ประชุมสัมมนา/อบรม
                </label>

                <label class="inline-flex items-center gap-[1.5mm] whitespace-nowrap">
                    <span class="h-[4mm] w-[4mm] border border-black" />
                    ออกหน่วย
                </label>

                <label class="inline-flex items-center gap-[1.5mm] whitespace-nowrap">
                    <span class="h-[4mm] w-[4mm] border border-black" />
                    วิทยากร
                </label>

                <label class="inline-flex items-center gap-[1.5mm] whitespace-nowrap">
                    <span class="h-[4mm] w-[4mm] border border-black" />
                    อื่น ๆ
                </label>
            </div>

            <p class="mb-[3mm] indent-[12mm] leading-[1.55]">
                รายละเอียดเหตุผล
                <span class="inline-block min-w-[122mm] border-b border-dotted border-black px-[1mm] break-words">
                    {{ data.purpose || '-' }}
                </span>
            </p>

            <p class="mb-[3mm] indent-[12mm] leading-[1.55]">
                ในระหว่างวันที่
                <span class="inline-block min-w-[43mm] border-b border-dotted border-black px-[1mm]">
                    {{ data.borrowedDateText }}
                </span>
                ถึงวันที่
                <span class="inline-block min-w-[43mm] border-b border-dotted border-black px-[1mm]">
                    {{ data.dueDateText }}
                </span>
            </p>

            <p class="mb-[4mm] indent-[12mm] leading-[1.55]">
                สถานที่
                <span class="inline-block min-w-[138mm] border-b border-dotted border-black px-[1mm] break-words">
                    {{ data.useLocation || '-' }}
                </span>
            </p>
        </section>

        <section class="print:break-inside-avoid">
            <p class="mb-[1.5mm] font-bold">รายการพัสดุครุภัณฑ์</p>

            <table class="w-full table-fixed border-collapse">
                <thead>
                    <tr>
                        <th class="w-[10%] border border-black bg-gray-100 p-[1.5mm] text-center font-bold">
                            ลำดับ
                        </th>
                        <th class="w-[25%] border border-black bg-gray-100 p-[1.5mm] text-center font-bold">
                            หมายเลขครุภัณฑ์
                        </th>
                        <th class="border border-black bg-gray-100 p-[1.5mm] text-center font-bold">
                            ยี่ห้อ/รุ่น
                        </th>
                        <th class="w-[16%] border border-black bg-gray-100 p-[1.5mm] text-center font-bold">
                            จำนวน
                        </th>
                    </tr>
                </thead>

                <tbody>
                    <tr v-for="(asset, index) in rows" :key="asset?.id || asset?.assetCode || `blank-${index}`">
                        <td class="h-[9mm] border border-black p-[1.5mm] text-center align-middle">
                            {{ index + 1 }}
                        </td>

                        <td class="h-[9mm] break-words border border-black px-[2mm] py-[1.5mm] align-middle">
                            {{ asset?.assetCode || '' }}
                        </td>

                        <td class="h-[9mm] break-words border border-black px-[2mm] py-[1.5mm] align-middle">
                            {{ asset?.brandModel || '' }}
                        </td>

                        <td class="h-[9mm] border border-black px-[2mm] py-[1.5mm] text-center align-middle">
                            {{ asset ? `${asset.quantity} ${asset.unit}` : '' }}
                        </td>
                    </tr>
                </tbody>
            </table>

            <p class="mt-[3mm] indent-[12mm] leading-[1.55]">
                โดยเมื่อครบตามกำหนด ข้าพเจ้าจะนำพัสดุ/ครุภัณฑ์ดังกล่าว
                มาคืนแก่งานคอมพิวเตอร์ในสภาพเดิมโดยเร็ว
            </p>

            <p class="mt-[3mm] indent-[12mm]">
                จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต
            </p>
        </section>

        <section class="mt-[5mm] flex justify-end print:break-inside-avoid">
            <div class="w-[88mm] text-center">
                <p class="my-[1.5mm]">
                    ลงชื่อ....................................................(ผู้ยืม/ผู้รับเครื่อง)
                </p>

                <p class="my-[1.5mm]">
                    ({{ data.borrowerName || '....................................................' }})
                </p>

                <p class="my-[1.5mm]">
                    ตำแหน่ง {{ data.position || '....................................................' }}
                </p>
            </div>
        </section>

        <section class="mt-[5mm] print:break-inside-avoid">
            <div class="flex items-center gap-[4mm]">
                <span class="font-bold">ความเห็นผู้อำนวยการโรงพยาบาลประสาทเชียงใหม่</span>

                <span class="ml-auto inline-flex items-center gap-[2mm]">
                    <span class="h-[4mm] w-[4mm] border border-black" />
                    อนุญาต
                </span>

                <span class="inline-flex items-center gap-[2mm]">
                    <span class="h-[4mm] w-[4mm] border border-black" />
                    ไม่อนุญาต
                </span>
            </div>

            <div class="mt-[8mm] flex justify-end">
                <div class="w-[88mm] text-center">
                    <p class="my-[1.5mm]">
                        ลงชื่อ....................................................
                    </p>

                    <p class="my-[1.5mm]">
                        (นายดลสุข พงษ์นิกร)
                    </p>

                    <p class="my-[1.5mm]">
                        ผู้อำนวยการโรงพยาบาลประสาทเชียงใหม่
                    </p>

                    <p class="my-[1.5mm]">
                        วันที่.............................................
                    </p>
                </div>
            </div>
        </section>

        <section class="mt-[5mm] print:break-inside-avoid">
            <table class="w-full table-fixed border-collapse">
                <tbody>
                    <tr>
                        <td class="w-[28%] border border-black p-[2.5mm] align-top">
                            <strong>สำหรับเจ้าหน้าที่งานคอมพิวเตอร์</strong>
                            <br>
                            รับเอกสาร [A6-1]
                            <br>
                            เลขที่............./..........
                            <br>
                            วันที่........................
                            <br>
                            เวลา........................
                        </td>

                        <td class="border border-black p-[2.5mm] align-top">
                            <strong>1. ส่งมอบ</strong>
                            <br>
                            ลงชื่อ............................ผู้ให้ยืม
                            <br>
                            วันที่...................................
                        </td>

                        <td class="border border-black p-[2.5mm] align-top">
                            <strong>2. รับพัสดุ/ครุภัณฑ์</strong>
                            <br>
                            ลงชื่อ.........................ผู้รับ
                            <br>
                            วันที่...................................
                        </td>

                        <td class="border border-black p-[2.5mm] align-top">
                            <strong>3. รับคืน/ตรวจสอบ</strong>
                            <br>
                            ลงชื่อ............................ผู้ให้ยืม
                            <br>
                            วันที่...................................
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
    </article>
</template>