async function main() {
    console.log('Skip demo seed data. The app now starts with an empty navigation database.')
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
