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
        <!-- รหัสฟอร์ม -->
        <!-- <div class="mb-[2mm] flex justify-end text-[14px] font-bold">
            [A6-2]
        </div> -->

        <!-- หัวเอกสาร -->
        <header class="mb-[4mm] grid grid-cols-[20mm_1fr_20mm] items-center gap-[3mm]">
            <div class="grid h-[18mm] w-[18mm] place-items-center border border-black text-[9px]">
                <!-- เมื่อมีโลโก้จริง:
        <img
          src="/images/hospital-logo.png"
          alt="โลโก้โรงพยาบาลประสาทเชียงใหม่"
          class="h-full w-full object-contain"
        >
        -->
                LOGO
            </div>

            <div class="text-center">
                <h1 class="m-0 text-[20px] font-bold leading-[1.2]">
                    แบบฟอร์มขออนุญาตยืมครุภัณฑ์คอมพิวเตอร์ ภายในโรงพยาบาลฯ
                </h1>

                <h2 class="mt-[1mm] text-[16px] font-bold leading-[1.2]">
                    กลุ่มงานดิจิทัลการแพทย์ โรงพยาบาลประสาทเชียงใหม่
                </h2>
            </div>

            <div class="self-start text-right font-bold">
                [A6-2]
            </div>
        </header>

        <!-- ส่วนที่ 1 -->
        <section class="mt-[3mm] print:break-inside-avoid">
            <div class="border border-b-0 border-black bg-gray-100 px-[3mm] py-[1.5mm] font-bold">
                ส่วนที่ 1 ผู้ขอใช้บริการ
            </div>

            <div class="border border-black px-[4mm] py-[3mm]">
                <div class="mb-[2.5mm] flex min-w-0 items-baseline gap-[2mm]">
                    <span>ชื่อผู้ขอใช้บริการ</span>
                    <span
                        class="min-w-[15mm] flex-1 border-b border-dotted border-black px-[1mm] pb-[0.5mm] break-words">
                        {{ data.borrowerName }}
                    </span>
                </div>

                <div class="mb-[2.5mm] flex min-w-0 items-baseline gap-[1.5mm]">
                    <span>ตำแหน่ง</span>
                    <span class="w-[30mm] border-b border-dotted border-black px-[1mm] pb-[0.5mm] break-words">
                        {{ data.position }}
                    </span>

                    <span>หน่วยงาน</span>
                    <span
                        class="min-w-[20mm] flex-1 border-b border-dotted border-black px-[1mm] pb-[0.5mm] break-words">
                        {{ data.department }}
                    </span>

                    <span>โทรศัพท์</span>
                    <span class="w-[30mm] border-b border-dotted border-black px-[1mm] pb-[0.5mm] break-words">
                        {{ data.phone || '-' }}
                    </span>
                </div>

                <div class="mb-[3mm]">
                    <p class="mb-[1.5mm]">เหตุผลในการขอยืมเพื่อ</p>

                    <div class="mb-[2mm] flex flex-wrap gap-x-[7mm] gap-y-[2mm]">
                        <label class="inline-flex items-center gap-[1.5mm] whitespace-nowrap">
                            <span
                                class="grid h-[4mm] w-[4mm] place-items-center border border-black text-[12px] font-bold" />
                            ประชุมสัมมนา/อบรม
                        </label>

                        <label class="inline-flex items-center gap-[1.5mm] whitespace-nowrap">
                            <span
                                class="grid h-[4mm] w-[4mm] place-items-center border border-black text-[12px] font-bold" />
                            วิทยากร
                        </label>

                        <label class="inline-flex items-center gap-[1.5mm] whitespace-nowrap">
                            <span
                                class="grid h-[4mm] w-[4mm] place-items-center border border-black text-[12px] font-bold" />
                            ใช้งานชั่วคราว
                        </label>

                        <label class="inline-flex items-center gap-[1.5mm] whitespace-nowrap">
                            <span
                                class="grid h-[4mm] w-[4mm] place-items-center border border-black text-[12px] font-bold" />
                            อื่น ๆ
                        </label>
                    </div>

                    <div class="flex min-w-0 items-baseline gap-[2mm]">
                        <span>รายละเอียดเหตุผล</span>
                        <span
                            class="min-w-[15mm] flex-1 border-b border-dotted border-black px-[1mm] pb-[0.5mm] break-words">
                            {{ data.purpose }}
                        </span>
                    </div>
                </div>

                <div class="mb-[2.5mm] flex flex-wrap items-baseline gap-[2mm]">
                    <span>ระยะเวลาที่ต้องการขอยืมใช้งาน ในระหว่างวันที่</span>
                    <span class="min-w-[35mm] border-b border-dotted border-black px-[1mm] pb-[0.5mm]">
                        {{ data.borrowedDateText }}
                    </span>

                    <span>ถึงวันที่</span>
                    <span class="min-w-[35mm] border-b border-dotted border-black px-[1mm] pb-[0.5mm]">
                        {{ data.dueDateText }}
                    </span>
                </div>

                <div class="flex min-w-0 items-baseline gap-[2mm]">
                    <span>สถานที่ที่ใช้งาน</span>
                    <span
                        class="min-w-[15mm] flex-1 border-b border-dotted border-black px-[1mm] pb-[0.5mm] break-words">
                        {{ data.useLocation }}
                    </span>
                </div>
            </div>
        </section>

        <!-- ส่วนที่ 2 -->
        <section class="mt-[3mm] print:break-inside-avoid">
            <div class="border border-b-0 border-black bg-gray-100 px-[3mm] py-[1.5mm] font-bold">
                ส่วนที่ 2 รายการพัสดุ/ครุภัณฑ์
            </div>

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
                            {{ asset ? [asset.brand, asset.model].filter(Boolean).join(' / ') : '' }}
                        </td>

                        <td class="h-[9mm] border border-black px-[2mm] py-[1.5mm] text-center align-middle">
                            {{ asset ? `${asset.quantity} ${asset.unit}` : '' }}
                        </td>
                    </tr>
                </tbody>
            </table>

            <p class="mt-[3mm] indent-[10mm]">
                เมื่อครบตามกำหนด ข้าพเจ้าจะนำพัสดุ/ครุภัณฑ์ดังกล่าว
                มาคืนแก่งานคอมพิวเตอร์ในสภาพเดิมโดยเร็ว
            </p>
        </section>

        <!-- ลายเซ็น -->
        <section class="mt-[6mm] grid grid-cols-2 gap-x-[14mm] print:break-inside-avoid">
            <div class="text-center">
                <p class="my-[1.5mm]">
                    ลงชื่อ.....................................................(ผู้ขอใช้บริการ)
                </p>
                <p class="my-[1.5mm]">
                    ({{ data.borrowerName }})
                </p>
                <p class="my-[1.5mm]">
                    วันที่.............................................
                </p>
            </div>

            <div class="text-center">
                <p class="my-[1.5mm]">
                    ลงชื่อ.....................................................(ผู้รับรอง/หัวหน้างาน)
                </p>
                <p class="my-[1.5mm]">
                    (.....................................................)
                </p>
                <p class="my-[1.5mm]">
                    วันที่.............................................
                </p>
            </div>
        </section>

        <!-- ตารางเจ้าหน้าที่ -->
        <section class="mt-[5mm] print:break-inside-avoid">
            <table class="w-full table-fixed border-collapse">
                <tbody>
                    <tr>
                        <td rowspan="2" class="w-[28%] border border-black p-[2.5mm] align-top">
                            <strong>สำหรับเจ้าหน้าที่</strong>
                            <br>
                            รับเอกสาร
                            <br>
                            เลขที่........................
                            <br>
                            วันที่........................
                            <br>
                            เวลา........................
                            <br><br>
                            ลงชื่อ................................
                        </td>

                        <td class="min-h-[27mm] border border-black p-[2.5mm] align-top">
                            <strong>1. หัวหน้างานคอมพิวเตอร์</strong>
                            <br>
                            ลงชื่อ............................
                            <br>
                            วันที่..................................
                        </td>

                        <td class="min-h-[27mm] border border-black p-[2.5mm] align-top">
                            <strong>2. เจ้าหน้าที่งานคอม ส่งมอบ</strong>
                            <br>
                            ลงชื่อ............................ผู้ให้ยืม
                            <br>
                            วันที่...................................
                        </td>
                    </tr>

                    <tr>
                        <td class="min-h-[27mm] border border-black p-[2.5mm] align-top">
                            <strong>3. ผู้ยืม รับพัสดุ/ครุภัณฑ์</strong>
                            <br>
                            ลงชื่อ.........................ผู้รับ
                            <br>
                            วันที่...................................
                        </td>

                        <td class="min-h-[27mm] border border-black p-[2.5mm] align-top">
                            <strong>4. เจ้าหน้าที่งานคอม รับคืน/ตรวจสอบ</strong>
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