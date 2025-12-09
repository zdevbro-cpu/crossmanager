const axios = require('axios')

const API_BASE = 'http://localhost:3000/api'

async function testSwmsApis() {
    try {
        console.log('🧪 Testing SWMS APIs...\n')

        // 1. Test Projects API
        console.log('1️⃣ Testing GET /api/projects')
        const projectsRes = await axios.get(`${API_BASE}/projects`)
        console.log(`   ✅ Found ${projectsRes.data.length} projects`)
        const firstProject = projectsRes.data[0]
        if (firstProject) {
            console.log(`   📋 First project: ${firstProject.name} (${firstProject.id})`)
        }

        // 2. Test Material Types API
        console.log('\n2️⃣ Testing GET /api/swms/material-types')
        const mtRes = await axios.get(`${API_BASE}/swms/material-types`)
        console.log(`   ✅ Found ${mtRes.data.length} material types`)

        // 3. Test Vendors API
        console.log('\n3️⃣ Testing GET /api/swms/vendors')
        const vendorsRes = await axios.get(`${API_BASE}/swms/vendors`)
        console.log(`   ✅ Found ${vendorsRes.data.length} vendors`)

        // 4. Test Generations API - ALL
        console.log('\n4️⃣ Testing GET /api/swms/generations?project_id=ALL')
        const genAllRes = await axios.get(`${API_BASE}/swms/generations?project_id=ALL`)
        console.log(`   ✅ Found ${genAllRes.data.length} generations (ALL)`)
        if (genAllRes.data.length > 0) {
            const gen = genAllRes.data[0]
            console.log(`   📦 First: ${gen.generation_date} | ${gen.material_name} | ${gen.quantity}톤`)
        }

        // 5. Test Generations API - Specific Project
        if (firstProject) {
            console.log(`\n5️⃣ Testing GET /api/swms/generations?project_id=${firstProject.id}`)
            const genProjectRes = await axios.get(`${API_BASE}/swms/generations?project_id=${firstProject.id}`)
            console.log(`   ✅ Found ${genProjectRes.data.length} generations for ${firstProject.name}`)
            if (genProjectRes.data.length > 0) {
                const gen = genProjectRes.data[0]
                console.log(`   📦 First: ${gen.generation_date} | ${gen.material_name} | ${gen.quantity}톤`)
            }
        }

        // 6. Test Weighings API - ALL
        console.log('\n6️⃣ Testing GET /api/swms/weighings?project_id=ALL')
        const weighAllRes = await axios.get(`${API_BASE}/swms/weighings?project_id=ALL`)
        console.log(`   ✅ Found ${weighAllRes.data.length} weighings (ALL)`)
        if (weighAllRes.data.length > 0) {
            const w = weighAllRes.data[0]
            console.log(`   ⚖️  First: ${w.weighing_date} | ${w.direction} | ${w.material_name} | ${w.net_weight}톤`)
        }

        // 7. Test Weighings API - Specific Project
        if (firstProject) {
            console.log(`\n7️⃣ Testing GET /api/swms/weighings?project_id=${firstProject.id}`)
            const weighProjectRes = await axios.get(`${API_BASE}/swms/weighings?project_id=${firstProject.id}`)
            console.log(`   ✅ Found ${weighProjectRes.data.length} weighings for ${firstProject.name}`)
            if (weighProjectRes.data.length > 0) {
                const w = weighProjectRes.data[0]
                console.log(`   ⚖️  First: ${w.weighing_date} | ${w.direction} | ${w.material_name} | ${w.net_weight}톤`)
            }
        }

        console.log('\n🎉 All API tests passed!')

    } catch (err) {
        console.error('❌ API Test Error:', err.message)
        if (err.response) {
            console.error('   Status:', err.response.status)
            console.error('   Data:', err.response.data)
        }
    }
}

testSwmsApis()
